import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool } from "@/db";
import { decryptSecret, encryptSecret } from "./storage";
import { appendExternalWorkspaceSource, workspaceTransaction, type WorkspaceUser } from "./workspace-service";
import { SourceError, parseGithubPayload, sourceCommand, verifyGithubSignature, type GithubPayload } from "./workspace-sources-contract";

const uuid=z.string().uuid();
const sha256=(value:string|Uint8Array)=>createHash("sha256").update(value).digest("hex");
type Credential={connection_id:string;team_id:string;owner_id:string;display_name:string;locale:string;repository:string;encrypted_secret:string;project_id:string};
type Connection={id:string;team_id:string;external_id:string;created_by:string;encrypted_secret:string|null;status:string;config:{workspaceProjectId?:string}};
async function scope(client:PoolClient,user:WorkspaceUser,projectId:string,write=false){
  const row=(await client.query<{team_id:string;role:string}>(`SELECT p.team_id,m.role FROM projects p JOIN team_memberships m ON m.team_id=p.team_id
    WHERE p.id=$1 AND m.user_id=$2 AND m.status='active'`,[uuid.parse(projectId),user.id])).rows[0];
  if(!row || (write && row.role!=="student_lead"))throw new SourceError("forbidden",403);
  return row;
}
async function connection(client:PoolClient,id:string,projectId:string){
  const row=(await client.query<Connection>(`SELECT * FROM source_connections WHERE id=$1 AND provider='github'
    AND config->>'workspaceProjectId'=$2 AND config->>'workspaceMode'='repository-webhook' FOR UPDATE`,[id,projectId])).rows[0];
  if(!row)throw new SourceError("connection_unavailable",404);return row;
}
async function audit(client:PoolClient,user:WorkspaceUser,teamId:string,id:string,action:string){
  await client.query("INSERT INTO audit_events(team_id,actor_user_id,action,entity_type,entity_id) VALUES($1,$2,$3,'source_connection',$4)",[teamId,user.id,action,id]);
}
export async function listWorkspaceSources(user:WorkspaceUser,projectId:string){
  return workspaceTransaction(user,async client=>{
    const access=await scope(client,user,projectId);
    const connections=(await client.query(`SELECT id,label,external_id AS repository,status,last_event_at AS "lastEventAt",last_error AS "lastError",created_at AS "createdAt"
      FROM source_connections WHERE team_id=$1 AND provider='github' AND config->>'workspaceProjectId'=$2
      AND config->>'workspaceMode'='repository-webhook' ORDER BY created_at DESC LIMIT 20`,[access.team_id,projectId])).rows;
    const receipts=(await client.query(`SELECT r.connection_id AS "connectionId",r.delivery_id AS "deliveryId",r.status,r.attempts,
      r.imported_count AS "importedCount",r.last_error AS "lastError",r.received_at AS "receivedAt",r.completed_at AS "completedAt"
      FROM workspace_source_receipts r JOIN source_connections c ON c.id=r.connection_id
      WHERE r.team_id=$1 AND c.config->>'workspaceProjectId'=$2 ORDER BY r.received_at DESC LIMIT 30`,[access.team_id,projectId])).rows;
    return {role:access.role,connections,receipts,limits:{connections:10,commitsPerPush:100,bodyBytes:262144},deliveryHistoryLimit:30};
  });
}
export async function manageWorkspaceSources(user:WorkspaceUser,raw:unknown){
  const input=sourceCommand.parse(raw);
  if(input.command==="retry"){
    await workspaceTransaction(user,async client=>{await scope(client,user,input.projectId,true);await connection(client,input.connectionId,input.projectId);});
    const credential=await getCredential(input.connectionId);
    if(credential.project_id!==input.projectId)throw new SourceError("forbidden",403);
    return processGithubReceipt(credential,input.deliveryId);
  }
  return workspaceTransaction(user,async client=>{
    const access=await scope(client,user,input.projectId,true);
    if(input.command==="create"){
      if(!process.env.SECRETS_ENCRYPTION_KEY || process.env.SECRETS_ENCRYPTION_KEY.length<32)throw new SourceError("encryption_unconfigured",503);
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["workspace-source-quota:"+access.team_id]);
      const previous=(await client.query<Connection & {label:string}>("SELECT * FROM source_connections WHERE id=$1",[input.requestId])).rows[0];
      if(previous){
        if(previous.created_by!==user.id || previous.config.workspaceProjectId!==input.projectId || previous.external_id!==input.repository || previous.label!==input.label)
          throw new SourceError("idempotency_conflict",409);
        return {id:previous.id,secret:null,replayed:true};
      }
      const count=(await client.query<{count:string}>("SELECT count(*) FROM source_connections WHERE team_id=$1 AND provider='github' AND status<>'disconnected'",[access.team_id])).rows[0];
      if(Number(count.count)>=10)throw new SourceError("connection_limit",422);
      const secret=randomBytes(32).toString("hex");
      await client.query(`INSERT INTO source_connections(id,team_id,provider,external_id,label,status,encrypted_secret,config,created_by)
        VALUES($1,$2,'github',$3,$4,'pending',$5,$6,$7)`,[input.requestId,access.team_id,input.repository,input.label,encryptSecret(secret),
        JSON.stringify({workspaceProjectId:input.projectId,workspaceMode:"repository-webhook",scope:"push-metadata-only"}),user.id]);
      await audit(client,user,access.team_id,input.requestId,"github.configure");
      return {id:input.requestId,secret,replayed:false};
    }
    const item=await connection(client,input.connectionId,input.projectId);
    if(input.command==="disconnect"){
      await client.query("UPDATE source_connections SET status='disconnected',encrypted_secret=NULL,last_error=NULL WHERE id=$1",[item.id]);
      await audit(client,user,access.team_id,item.id,"github.disconnect");return {id:item.id,status:"disconnected"};
    }
    if(!process.env.SECRETS_ENCRYPTION_KEY || process.env.SECRETS_ENCRYPTION_KEY.length<32)throw new SourceError("encryption_unconfigured",503);
    const secret=randomBytes(32).toString("hex");
    await client.query("UPDATE source_connections SET status='pending',encrypted_secret=$1,created_by=$2,last_error=NULL WHERE id=$3",[encryptSecret(secret),user.id,item.id]);
    await audit(client,user,access.team_id,item.id,"github.rotate");return {id:item.id,secret};
  });
}
async function getCredential(connectionId:string){
  uuid.parse(connectionId);
  const row=(await pool.query<Credential>("SELECT * FROM public.workspace_github_credential($1)",[connectionId])).rows[0];
  if(!row)throw new SourceError("connection_unavailable",404);return row;
}
function owner(row:Credential):WorkspaceUser{return{id:row.owner_id,displayName:row.display_name,locale:row.locale};}
export async function receiveGithubDelivery(connectionId:string,deliveryId:string,event:string|null,signature:string|null,body:Uint8Array,options:{afterSource?:()=>void}={}){
  uuid.parse(deliveryId);
  const credential=await getCredential(connectionId);
  verifyGithubSignature(body,signature,decryptSecret(credential.encrypted_secret));
  const payload=parseGithubPayload(event,body,credential.repository),payloadHash=sha256(body);
  // Receipt is durable before processing. A later failure cannot erase delivery
  // evidence; only the bounded, whitelisted metadata is retained (no code/emails).
  await workspaceTransaction(owner(credential),async client=>{
    const current=await connection(client,connectionId,credential.project_id);
    if(current.status==="disconnected" || current.encrypted_secret!==credential.encrypted_secret)throw new SourceError("connection_changed",409);
    const previous=(await client.query<{payload_hash:string}>("SELECT payload_hash FROM workspace_source_receipts WHERE connection_id=$1 AND delivery_id=$2",[connectionId,deliveryId])).rows[0];
    if(previous){if(previous.payload_hash!==payloadHash)throw new SourceError("delivery_conflict",409);return;}
    const count=(await client.query<{count:string}>("SELECT count(*) FROM workspace_source_receipts WHERE connection_id=$1",[connectionId])).rows[0];
    if(Number(count.count)>=1000)throw new SourceError("receipt_limit",429);
    await client.query(`INSERT INTO workspace_source_receipts(connection_id,team_id,delivery_id,payload_hash,payload)
      VALUES($1,$2,$3,$4,$5)`,[connectionId,credential.team_id,deliveryId,payloadHash,JSON.stringify(payload)]);
  });
  return processGithubReceipt(credential,deliveryId,options);
}
async function processGithubReceipt(credential:Credential,deliveryId:string,options:{afterSource?:()=>void}={}){
  const user=owner(credential);
  try{
    return await workspaceTransaction(user,async client=>{
      const current=await connection(client,credential.connection_id,credential.project_id);
      if(current.status==="disconnected" || current.created_by!==credential.owner_id || current.encrypted_secret!==credential.encrypted_secret)
        throw new SourceError("connection_unavailable",404);
      const receipt=(await client.query<{payload:GithubPayload;status:string;attempts:number;imported_count:number}>(
        "SELECT * FROM workspace_source_receipts WHERE connection_id=$1 AND delivery_id=$2 FOR UPDATE",[credential.connection_id,deliveryId])).rows[0];
      if(!receipt)throw new SourceError("delivery_unavailable",404);
      if(receipt.status==="complete")return{status:"complete",importedCount:receipt.imported_count,replayed:true};
      if(receipt.attempts>=5)throw new SourceError("retry_limit",422);
      let importedCount=0;
      if(receipt.payload.kind==="push" && !receipt.payload.data.deleted){
        const data=receipt.payload.data;
        for(const commit of data.commits){
          const sha=commit.id.toLowerCase(),url=`https://github.com/${data.repository.full_name}/commit/${sha}`;
          const metadata={repository:data.repository.full_name,branch:data.ref,sha,before:data.before,after:data.after,forced:data.forced,
            externalActor:commit.author.username||commit.author.name||"GitHub author",sender:data.sender?.login??null,url,deliveryId,source:"github.push"};
          const result=await appendExternalWorkspaceSource(client,user,credential.project_id,{
            connectionId:credential.connection_id,providerEventId:`${credential.connection_id}:${sha}`,title:commit.message.split(/\r?\n/)[0].slice(0,240),
            body:commit.message+"\n\n"+url,occurredAt:commit.timestamp,actor:metadata.externalActor,revision:sha,metadata,contentHash:sha256(JSON.stringify(metadata))});
          if(result.inserted)importedCount++;
          options.afterSource?.();
        }
      }
      await client.query(`UPDATE workspace_source_receipts SET status='complete',attempts=attempts+1,imported_count=$1,last_error=NULL,completed_at=now()
        WHERE connection_id=$2 AND delivery_id=$3`,[importedCount,credential.connection_id,deliveryId]);
      await client.query("UPDATE source_connections SET status='receiving',last_event_at=now(),last_error=NULL WHERE id=$1",[credential.connection_id]);
      return {status:"complete",importedCount,replayed:false};
    });
  }catch(error){
    // The failed canonical transaction is fully rolled back. Preserve the receipt
    // for explicit retry/redelivery; never expose provider payload or SQL errors.
    await workspaceTransaction(user,async client=>{
      const failed=await client.query(`UPDATE workspace_source_receipts SET status='failed',attempts=LEAST(attempts+1,5),last_error='ingestion_failed'
        WHERE connection_id=$1 AND delivery_id=$2 AND status<>'complete'`,[credential.connection_id,deliveryId]);
      if(failed.rowCount)await client.query("UPDATE source_connections SET status='error',last_error='ingestion_failed' WHERE id=$1 AND status<>'disconnected'",[credential.connection_id]);
    }).catch(()=>{});
    if(error instanceof SourceError)throw error;
    throw new SourceError("ingestion_failed",503);
  }
}

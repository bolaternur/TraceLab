import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { appendWorkspaceRecord, workspaceTransaction, type WorkspaceUser } from "./workspace-service";
import { MEDIA_LIMITS, MediaError, mediaHash, uploadFingerprint, uploadMetadata, type UploadMetadata } from "./workspace-media-contract";
import { prepareMedia, type PreparedMedia } from "./workspace-media-files";
import { mediaStorage } from "./workspace-media-storage";
import type { StorageAdapter } from "./storage";

type UploadRow = { id:string; user_id:string; request_id:string; payload_hash:string; team_id:string; project_id:string;
  status:string; storage_keys:string[]; artifact_id:string|null; model_id:string|null; record_id:string|null; expires_at:Date };
type MediaRow = { id:string; team_id:string; source_event_id:string; kind:string; storage_key:string|null; mime_type:string|null;
  size_bytes:number|null; sha256:string|null; metadata:Record<string,unknown>; created_at:Date; title:string; summary:string|null;
  occurred_at:Date; actor_user_id:string|null; author_label:string|null; project_id:string; latest:string|null;
  model_id:string|null; model_name:string|null; category:string|null; version_label:string|null; model_status:string|null;
  record_id:string|null };
const uuid=z.string().uuid();
const deny=()=>new MediaError("forbidden",403);
async function access(client:PoolClient,user:WorkspaceUser,teamId:string,projectId:string,write=false) {
  const result=await client.query<{role:string}>(`SELECT m.role FROM team_memberships m JOIN projects p ON p.team_id=m.team_id
    WHERE m.team_id=$1 AND m.user_id=$2 AND m.status='active' AND p.id=$3`,[uuid.parse(teamId),user.id,uuid.parse(projectId)]);
  if(!result.rows[0] || (write && !["student","student_lead"].includes(result.rows[0].role)))throw deny();
  return result.rows[0].role;
}
export async function authorizeMediaUpload(user:WorkspaceUser,input:UploadMetadata) {
  return workspaceTransaction(user,client=>access(client,user,input.teamId,input.projectId,true));
}
async function audit(client:PoolClient,user:WorkspaceUser,teamId:string,action:string,entityType:string,entityId:string) {
  await client.query("INSERT INTO audit_events(team_id,actor_user_id,action,entity_type,entity_id) VALUES($1,$2,$3,$4,$5)",[teamId,user.id,action,entityType,entityId]);
}
async function usage(client:PoolClient,teamId:string) {
  const saved=(await client.query<{total:string}>(`SELECT COALESCE(sum(COALESCE(size_bytes,0)+COALESCE((metadata->'thumb'->>'sizeBytes')::bigint,0)),0)::text AS total
    FROM artifacts WHERE team_id=$1`,[teamId])).rows[0];
  const reserved=(await client.query<{total:string}>(`SELECT COALESCE(sum(reserved_bytes),0)::text AS total FROM workspace_uploads
    WHERE team_id=$1 AND status IN ('staging','cleanup_pending')`,[teamId])).rows[0];
  return { usedBytes:Number(saved.total), reservedBytes:Number(reserved.total), quotaBytes:MEDIA_LIMITS.teamBytes };
}
const selectMedia=`SELECT a.*,e.title,e.summary,e.occurred_at,e.actor_user_id,e.project_id,u.display_name AS author_label,
  m.id AS model_id,m.name AS model_name,m.category,m.version_label,m.status AS model_status,
  w.local_id AS record_id,
  (SELECT n.body FROM annotations n WHERE n.entity_type='artifact' AND n.entity_id=a.id AND n.field='media_metadata'
   ORDER BY n.created_at DESC,n.id DESC LIMIT 1) AS latest
  FROM artifacts a JOIN source_events e ON e.id=a.source_event_id AND e.team_id=a.team_id
  LEFT JOIN users u ON u.id=e.actor_user_id LEFT JOIN robot_models m ON m.artifact_id=a.id AND m.team_id=a.team_id
  LEFT JOIN workspace_entity_map w ON w.entity_id=e.id AND w.entity_type='source_event' AND w.project_id=e.project_id`;
function mediaView(row:MediaRow) {
  let edited:Record<string,unknown>={};
  try{if(row.latest)edited=JSON.parse(row.latest);}catch{/* Original fields remain readable. */}
  return { artifactId:row.id,teamId:row.team_id,projectId:row.project_id,sourceEventId:row.source_event_id,recordId:row.record_id,kind:row.model_id?"model":row.kind,
    name:String(edited.name ?? row.model_name ?? row.title),caption:String(edited.caption ?? row.metadata.caption ?? row.summary ?? ""),
    alt:String(edited.alt ?? row.metadata.alt ?? ""),status:edited.status ?? row.model_status ?? "active",
    mimeType:row.mime_type,sizeBytes:row.size_bytes,sha256:row.sha256,createdAt:row.created_at,occurredAt:row.occurred_at,
    authorLabel:row.author_label,authorUserId:row.actor_user_id,originalName:row.title,
    url:"/api/workspace/media/"+row.id,thumbnailUrl:row.metadata.thumb?"/api/workspace/media/"+row.id+"?variant=thumbnail":null,
    model:row.model_id?{id:row.model_id,category:row.category,versionLabel:row.version_label,
      previousModelId:row.metadata.previousModelId ?? null,viewerUrl:"/workspace/model/"+row.model_id}:null };
}
export async function listWorkspaceMedia(user:WorkspaceUser,options:{teamId:string;projectId:string;offset?:number;mode?:string}) {
  const offset=z.number().int().min(0).max(100000).parse(options.offset ?? 0);
  return workspaceTransaction(user,async client=>{
    const role=await access(client,user,options.teamId,options.projectId);
    const extra=options.mode==="models"?" AND m.id IS NOT NULL":options.mode==="gallery"?" AND m.id IS NULL":"";
    const rows=(await client.query<MediaRow>(selectMedia+" WHERE a.team_id=$1 AND e.project_id=$2"+extra+" ORDER BY a.created_at DESC,a.id DESC LIMIT 51 OFFSET $3",
      [options.teamId,options.projectId,offset])).rows;
    await audit(client,user,options.teamId,"media.list","project",options.projectId);
    return {items:rows.slice(0,50).map(row=>({...mediaView(row),canEdit:row.actor_user_id===user.id&&["student","student_lead"].includes(role)})),nextOffset:rows.length>50?offset+50:null,role,usage:await usage(client,options.teamId),
      acceptedFormats:["image/jpeg","image/png","image/webp","application/pdf","text/csv","model/gltf-binary"],limits:MEDIA_LIMITS};
  });
}

/** Deletes only unreferenced staging keys recorded by this pipeline; never finalized source bytes. */
export async function cleanupWorkspaceUploads(user:WorkspaceUser,teamId:string,projectId:string,storage:StorageAdapter=mediaStorage) {
  const rows=await workspaceTransaction(user,async client=>{
    await access(client,user,teamId,projectId,true);
    return (await client.query<UploadRow>(`UPDATE workspace_uploads SET status='cleanup_pending'
      WHERE id IN (SELECT id FROM workspace_uploads WHERE team_id=$1 AND project_id=$2 AND artifact_id IS NULL
        AND ((status='staging' AND expires_at<now()) OR status='cleanup_pending') ORDER BY created_at LIMIT 10 FOR UPDATE SKIP LOCKED)
      RETURNING *`,[teamId,projectId])).rows;
  });
  for(const row of rows) {
    try {
      for(const key of row.storage_keys)await storage.delete(key);
      await workspaceTransaction(user,client=>client.query("UPDATE workspace_uploads SET status='cleaned',reserved_bytes=0 WHERE id=$1 AND status='cleanup_pending' AND artifact_id IS NULL",[row.id]));
    } catch {/* Keep the durable cleanup row so a later authenticated retry can reclaim the keys. */}
  }
  return rows.length;
}
type UploadOptions={ storage?:StorageAdapter; afterCanonicalWrite?:()=>void; beforeFinalize?:()=>Promise<void> };
export async function uploadWorkspaceMedia(user:WorkspaceUser,raw:UploadMetadata,bytes:Buffer,options:UploadOptions={}) {
  const input=uploadMetadata.parse(raw),storage=options.storage ?? mediaStorage;
  await authorizeMediaUpload(user,input);
  await cleanupWorkspaceUploads(user,input.teamId,input.projectId,storage);
  const prepared=await prepareMedia(input,bytes),fingerprint=uploadFingerprint(input,bytes);
  const stage=await workspaceTransaction(user,async client=>{
    await access(client,user,input.teamId,input.projectId,true);
    // Serialize reservations and quota checks across members, tabs and projects of this team.
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["media:"+input.teamId]);
    const previous=(await client.query<UploadRow>("SELECT * FROM workspace_uploads WHERE user_id=$1 AND request_id=$2 FOR UPDATE",[user.id,input.requestId])).rows[0];
    if(previous) {
      if(previous.payload_hash!==fingerprint)throw new MediaError("idempotency_conflict",409);
      if(previous.status==="finalized")return previous;
      if(previous.status!=="cleaned")throw new MediaError("upload_in_progress",409);
    }
    const recent=(await client.query<{count:string}>("SELECT count(*) FROM workspace_uploads WHERE user_id=$1 AND created_at>now()-interval '1 minute'",[user.id])).rows[0];
    if(Number(recent.count)>=MEDIA_LIMITS.uploadsPerMinute)throw new MediaError("upload_rate_limited",429);
    const used=await usage(client,input.teamId),reserved=prepared.bytes.length+(prepared.thumbnail?.length ?? 0);
    if(used.usedBytes+used.reservedBytes+reserved>used.quotaBytes)throw new MediaError("storage_quota_exceeded",413);
    if(input.subsystemId) {
      const ref=await client.query("SELECT id FROM subsystems WHERE id=$1 AND team_id=$2 AND project_id=$3",[input.subsystemId,input.teamId,input.projectId]);
      if(!ref.rowCount)throw deny();
    }
    if(input.model?.previousModelId) {
      const ref=await client.query("SELECT id FROM robot_models WHERE id=$1 AND team_id=$2 AND project_id=$3",[input.model.previousModelId,input.teamId,input.projectId]);
      if(!ref.rowCount)throw deny();
    }
    const id=previous?.id ?? randomUUID(),objectId=randomUUID();
    const keys=[`${input.teamId}/uploads/${objectId}/source.${prepared.extension}`];
    if(prepared.thumbnail)keys.push(`${input.teamId}/uploads/${objectId}/thumbnail.webp`);
    if(previous) return (await client.query<UploadRow>(`UPDATE workspace_uploads SET status='staging',storage_keys=$1,reserved_bytes=$2,
      expires_at=now()+interval '15 minutes' WHERE id=$3 RETURNING *`,[JSON.stringify(keys),reserved,id])).rows[0];
    return (await client.query<UploadRow>(`INSERT INTO workspace_uploads(id,user_id,request_id,team_id,project_id,payload_hash,reserved_bytes,storage_keys)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[id,user.id,input.requestId,input.teamId,input.projectId,fingerprint,reserved,JSON.stringify(keys)])).rows[0];
  });
  if(stage.status==="finalized")return {artifactId:stage.artifact_id,modelId:stage.model_id,recordId:stage.record_id,replayed:true};
  try {
    await storage.put(stage.storage_keys[0],prepared.bytes,prepared.mimeType);
    if(prepared.thumbnail)await storage.put(stage.storage_keys[1],prepared.thumbnail,"image/webp");
    await options.beforeFinalize?.();
    return await finalizeUpload(user,input,stage,prepared,options);
  }catch(error) {
    // COMMIT can have an unknown outcome after a broken connection. Check the durable row first;
    // if the DB is unavailable, retain keys for recovery instead of deleting a possibly committed file.
    try {
      const state=await workspaceTransaction(user,async client=>{
        const row=(await client.query<UploadRow>("SELECT * FROM workspace_uploads WHERE id=$1 FOR UPDATE",[stage.id])).rows[0];
        if(row?.status==="staging" && JSON.stringify(row.storage_keys)===JSON.stringify(stage.storage_keys))
          await client.query("UPDATE workspace_uploads SET status='cleanup_pending' WHERE id=$1",[stage.id]);
        return row;
      });
      if(state?.status==="finalized")return {artifactId:state.artifact_id,modelId:state.model_id,recordId:state.record_id,replayed:true};
      await cleanupWorkspaceUploads(user,input.teamId,input.projectId,storage);
    }catch{/* A durable staging row remains; do not silently forget failed bytes. */}
    throw error;
  }
}
async function finalizeUpload(user:WorkspaceUser,input:UploadMetadata,stage:UploadRow,prepared:PreparedMedia,options:UploadOptions) {
  return workspaceTransaction(user,async client=>{
    await access(client,user,input.teamId,input.projectId,true);
    const locked=(await client.query<UploadRow>("SELECT * FROM workspace_uploads WHERE id=$1 FOR UPDATE",[stage.id])).rows[0];
    if(!locked || locked.status!=="staging" || JSON.stringify(locked.storage_keys)!==JSON.stringify(stage.storage_keys)
      || new Date(locked.expires_at).getTime()<Date.now())throw new MediaError("upload_expired",409);
    const created=await appendWorkspaceRecord(client,user,input.projectId,{kind:"source",title:input.name,body:input.caption,
      sourceType:input.kind==="model"?"CAD":input.kind,createdAt:input.occurredAt,revision:input.model?.versionLabel ?? ""});
    if(created.teamId!==input.teamId)throw deny();
    const artifactId=randomUUID(),modelId=input.model?randomUUID():null;
    const metadata={...prepared.metadata,finalized:true,recordId:created.recordId,previousModelId:input.model?.previousModelId ?? null,
      ...(prepared.thumbnail?{thumb:{storageKey:stage.storage_keys[1],mimeType:"image/webp",sizeBytes:prepared.thumbnail.length,sha256:mediaHash(prepared.thumbnail)}}:{})};
    await client.query(`INSERT INTO artifacts(id,team_id,source_event_id,kind,storage_key,mime_type,size_bytes,sha256,metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[artifactId,input.teamId,created.sourceEventId,input.kind==="model"?"cad_model":input.kind,
      stage.storage_keys[0],prepared.mimeType,prepared.bytes.length,mediaHash(prepared.bytes),JSON.stringify(metadata)]);
    if(input.subsystemId)await client.query("UPDATE source_events SET subsystem_id=$1 WHERE id=$2",[input.subsystemId,created.sourceEventId]);
    if(input.model)await client.query(`INSERT INTO robot_models(id,team_id,project_id,subsystem_id,source_event_id,artifact_id,name,category,version_label,description,tags,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[modelId,input.teamId,input.projectId,input.subsystemId ?? null,created.sourceEventId,artifactId,
      input.name,input.model.category,input.model.versionLabel,input.caption,JSON.stringify(input.model.tags),user.id]);
    options.afterCanonicalWrite?.();
    await client.query("UPDATE workspace_uploads SET status='finalized',artifact_id=$1,model_id=$2,record_id=$3,reserved_bytes=0 WHERE id=$4",[artifactId,modelId,created.recordId,stage.id]);
    await audit(client,user,input.teamId,"media.upload","artifact",artifactId);
    return {artifactId,modelId,recordId:created.recordId,replayed:false};
  });
}
export async function readWorkspaceMedia(user:WorkspaceUser,artifactId:string,thumbnail=false,storage:StorageAdapter=mediaStorage) {
  return workspaceTransaction(user,async client=>{
    const row=(await client.query<MediaRow>(selectMedia+" WHERE a.id=$1",[uuid.parse(artifactId)])).rows[0];
    if(!row)throw new MediaError("media_not_found",404);
    await access(client,user,row.team_id,row.project_id);
    const thumb=row.metadata.thumb as {storageKey?:string;mimeType?:string;sha256?:string}|undefined;
    const key=thumbnail?thumb?.storageKey:row.storage_key;
    if(!key)throw new MediaError("media_not_found",404);
    const bytes=await storage.get(key);
    if(!bytes)throw new MediaError("media_unavailable",503);
    const expected=thumbnail?thumb?.sha256:row.sha256;
    if(expected && mediaHash(bytes)!==expected)throw new MediaError("media_integrity_failed",503);
    await audit(client,user,row.team_id,"media.read","artifact",row.id);
    return {bytes,mimeType:thumbnail?"image/webp":row.mime_type ?? "application/octet-stream",item:mediaView(row)};
  });
}
const mediaPatch=z.object({name:z.string().trim().min(1).max(160),caption:z.string().max(5000),alt:z.string().max(500),status:z.enum(["active","archived"])}).strict();
export async function updateWorkspaceMedia(user:WorkspaceUser,artifactId:string,raw:unknown) {
  const fields=mediaPatch.parse(raw);
  return workspaceTransaction(user,async client=>{
    const row=(await client.query<MediaRow>(selectMedia+" WHERE a.id=$1",[uuid.parse(artifactId)])).rows[0];
    if(!row)throw new MediaError("media_not_found",404);
    await access(client,user,row.team_id,row.project_id,true);
    // Leading a team does not transfer authorship of a student's explanation.
    if(row.actor_user_id!==user.id)throw deny();
    await client.query("SELECT id FROM artifacts WHERE id=$1 FOR UPDATE",[row.id]);
    const previous=(await client.query<{id:string}>("SELECT id FROM annotations WHERE entity_type='artifact' AND entity_id=$1 AND field='media_metadata' ORDER BY created_at DESC,id DESC LIMIT 1",[row.id])).rows[0];
    await client.query(`INSERT INTO annotations(team_id,entity_type,entity_id,field,author_user_id,body,source_method,provenance,supersedes_id)
      VALUES($1,'artifact',$2,'media_metadata',$3,$4,'typed','student',$5)`,[row.team_id,row.id,user.id,JSON.stringify(fields),previous?.id ?? null]);
    await audit(client,user,row.team_id,"media.metadata","artifact",row.id);
    return {artifactId:row.id,...fields};
  });
}
export async function getWorkspaceModel(user:WorkspaceUser,modelId:string) {
  return workspaceTransaction(user,async client=>{
    const row=(await client.query<MediaRow>(selectMedia+" WHERE m.id=$1",[uuid.parse(modelId)])).rows[0];
    if(!row)throw new MediaError("media_not_found",404);
    await access(client,user,row.team_id,row.project_id);
    return mediaView(row);
  });
}

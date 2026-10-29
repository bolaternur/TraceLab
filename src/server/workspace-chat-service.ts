import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {workspaceTransaction,type WorkspaceUser} from './workspace-service';
import {chatPost,chatAttachment,CHAT_LIMITS,ChatError,chatHash,sequence,voiceType,type ChatAttachmentInput} from './workspace-chat-contract';
import {prepareMedia} from './workspace-media-files';
import {mediaStorage} from './workspace-media-storage';
import type {StorageAdapter} from './storage';
const uuid=z.string().uuid();
export async function chatAccess(client:PoolClient,user:WorkspaceUser,teamId:string){
  const result=await client.query(`SELECT role FROM team_memberships WHERE team_id=$1 AND user_id=$2 AND status='active'`,[uuid.parse(teamId),user.id]);
  if(!result.rows[0])throw new ChatError('forbidden',403);
  return result.rows[0].role as string;
}
export async function chatRate(client:PoolClient,user:WorkspaceUser,teamId:string,kind:string,limit:number){
  const result=await client.query<{hits:number}>(`INSERT INTO workspace_chat_rate_limits(team_id,user_id,kind) VALUES($1,$2,$3)
    ON CONFLICT(team_id,user_id,kind) DO UPDATE SET
      hits=CASE WHEN workspace_chat_rate_limits.window_start<now()-interval '1 minute' THEN 1 ELSE workspace_chat_rate_limits.hits+1 END,
      window_start=CASE WHEN workspace_chat_rate_limits.window_start<now()-interval '1 minute' THEN now() ELSE workspace_chat_rate_limits.window_start END RETURNING hits`,[teamId,user.id,kind]);
  if(result.rows[0].hits>limit)throw new ChatError('rate_limited',429);
}
type AttachmentRow={id:string;team_id:string;user_id:string;request_id:string;kind:'photo'|'voice';mime_type:string;size_bytes:string|number;duration_ms:number|null;storage_key:string;sha256:string;payload_hash:string;status:string;expires_at:Date};
export const attachmentView=(row:AttachmentRow)=>({id:row.id,kind:row.kind,mimeType:row.mime_type,sizeBytes:Number(row.size_bytes),durationMs:row.duration_ms,durationVerified:false,url:'/api/workspace/chat/attachments/'+row.id});
type MessageRow={id:string;sequence:string;team_id:string;user_id:string;body:string;created_at:Date;display_name:string;attachment:AttachmentRow|null;payload_hash:string};
const messageSelect=`SELECT m.*,m.sequence::text AS sequence,u.display_name,
  CASE WHEN a.id IS NULL THEN NULL ELSE to_jsonb(a) END AS attachment
  FROM workspace_chat_messages m JOIN users u ON u.id=m.user_id LEFT JOIN workspace_chat_attachments a ON a.id=m.attachment_id AND a.team_id=m.team_id`;
const messageView=(row:MessageRow)=>({id:row.id,sequence:row.sequence,text:row.body,authorId:row.user_id,authorName:row.display_name,createdAt:row.created_at,attachment:row.attachment?attachmentView(row.attachment):null});
export async function listTeamChat(user:WorkspaceUser,teamId:string,options:{before?:string|null;after?:string|null}={}){
  const before=sequence(options.before),after=sequence(options.after);if(before&&after)throw new ChatError('invalid_cursor');
  return workspaceTransaction(user,async client=>{
    await chatAccess(client,user,teamId);
    const rows=(await client.query<MessageRow>(`${messageSelect} WHERE m.team_id=$1 ${before?'AND m.sequence<$2':after?'AND m.sequence>$2':''}
      ORDER BY m.sequence ${after?'ASC':'DESC'} LIMIT 51`,before||after?[teamId,before||after]:[teamId])).rows;
    const hasMore=rows.length>50,items=rows.slice(0,50);if(!after)items.reverse();
    const latest=(await client.query<{value:string}>(`SELECT COALESCE(max(sequence),0)::text AS value FROM workspace_chat_messages WHERE team_id=$1`,[teamId])).rows[0].value;
    return {teamId,userId:user.id,items:items.map(messageView),nextBefore:!after&&hasMore?items[0]?.sequence??null:null,nextAfter:after&&hasMore?items.at(-1)?.sequence??null:null,hasMore,latestSequence:latest,limits:CHAT_LIMITS};
  });
}
export async function sendTeamChat(user:WorkspaceUser,raw:unknown){
  const input=chatPost.parse(raw),fingerprint=chatHash(JSON.stringify(input));
  return workspaceTransaction(user,async client=>{
    await chatAccess(client,user,input.teamId);
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,['chat-request:'+user.id+':'+input.requestId]);
    const previous=(await client.query<MessageRow>(`${messageSelect} WHERE m.user_id=$1 AND m.request_id=$2`,[user.id,input.requestId])).rows[0];
    if(previous){if(previous.payload_hash!==fingerprint||previous.team_id!==input.teamId)throw new ChatError('request_conflict',409);return {message:messageView(previous),deduplicated:true};}
    await chatRate(client,user,input.teamId,'message',60);
    if(input.attachmentId){
      const attachment=(await client.query<AttachmentRow>(`SELECT * FROM workspace_chat_attachments WHERE id=$1 AND team_id=$2 AND user_id=$3 AND status='ready' AND expires_at>now() FOR UPDATE`,[input.attachmentId,input.teamId,user.id])).rows[0];
      if(!attachment)throw new ChatError('attachment_unavailable',409);
      await client.query(`UPDATE workspace_chat_attachments SET status='attached' WHERE id=$1`,[attachment.id]);
    }
    const id=randomUUID();
    await client.query(`INSERT INTO workspace_chat_messages(id,team_id,user_id,request_id,body,attachment_id,payload_hash) VALUES($1,$2,$3,$4,$5,$6,$7)`,[id,input.teamId,user.id,input.requestId,input.text,input.attachmentId??null,fingerprint]);
    const message=(await client.query<MessageRow>(`${messageSelect} WHERE m.id=$1`,[id])).rows[0];
    return {message:messageView(message),deduplicated:false};
  });
}
export async function uploadChatAttachment(user:WorkspaceUser,raw:ChatAttachmentInput,original:Buffer,storage:StorageAdapter=mediaStorage){
  const input=chatAttachment.parse(raw);
  // Authorize before decoding; this endpoint never creates engineering source records.
  await workspaceTransaction(user,client=>chatAccess(client,user,input.teamId));
  await cleanupChatAttachments(user,input.teamId,storage,input.requestId);
  let bytes:Buffer,mimeType:string,extension:string;
  if(input.kind==='photo'){
    const photo=await prepareMedia({teamId:input.teamId,projectId:input.teamId,requestId:input.requestId,name:'Chat photo',filename:input.filename,caption:'',alt:'',kind:'photo',occurredAt:new Date().toISOString()},original);
    bytes=photo.bytes;mimeType=photo.mimeType;extension=photo.extension;
  }else{
    mimeType=voiceType(original);if(input.mimeType.split(';')[0].trim().toLowerCase()!==mimeType)throw new ChatError('unsupported_audio');
    bytes=original;extension=mimeType==='audio/ogg'?'ogg':mimeType==='audio/mp4'?'m4a':'webm';
  }
  const fingerprint=chatHash(JSON.stringify(input)+':'+chatHash(original));
  const reserved=await workspaceTransaction(user,async client=>{
    await chatAccess(client,user,input.teamId);
    // Same lock as project uploads, so both features share the 500 MiB team budget.
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,['media:'+input.teamId]);
    const old=(await client.query<AttachmentRow>(`SELECT * FROM workspace_chat_attachments WHERE user_id=$1 AND request_id=$2`,[user.id,input.requestId])).rows[0];
    if(old){if(old.payload_hash!==fingerprint||old.team_id!==input.teamId)throw new ChatError('request_conflict',409);if(old.status==='attached'||old.status==='ready'&&new Date(old.expires_at).getTime()>Date.now())return {row:old,existing:true};if(old.status==='ready')throw new ChatError('attachment_expired',409);if(old.status!=='failed')throw new ChatError('upload_pending',409);}
    await chatRate(client,user,input.teamId,'upload',12);
    const total=(await client.query<{value:string}>(`SELECT (
      COALESCE((SELECT sum(COALESCE(size_bytes,0)+COALESCE((metadata->'thumb'->>'sizeBytes')::bigint,0)) FROM artifacts WHERE team_id=$1),0)+
      COALESCE((SELECT sum(reserved_bytes) FROM workspace_uploads WHERE team_id=$1 AND status IN ('staging','cleanup_pending')),0)+
      COALESCE((SELECT sum(size_bytes) FROM workspace_chat_attachments WHERE team_id=$1 AND status<>'failed'),0))::text AS value`,[input.teamId])).rows[0].value;
    if(Number(total)+bytes.length>CHAT_LIMITS.teamBytes)throw new ChatError('storage_quota_exceeded',413);
    const id=old?.id||randomUUID(),key=`chat/${input.teamId}/${user.id}/${randomUUID()}.${extension}`;
    if(old){
      const row=(await client.query<AttachmentRow>(`UPDATE workspace_chat_attachments SET status='staging',storage_key=$1,size_bytes=$2,sha256=$3,expires_at=now()+interval '15 minutes' WHERE id=$4 AND user_id=$5 AND status='failed' RETURNING *`,[key,bytes.length,chatHash(bytes),old.id,user.id])).rows[0];
      return {row,existing:false};
    }
    const row=(await client.query<AttachmentRow>(`INSERT INTO workspace_chat_attachments(id,team_id,user_id,request_id,kind,mime_type,size_bytes,duration_ms,storage_key,sha256,payload_hash)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[id,input.teamId,user.id,input.requestId,input.kind,mimeType,bytes.length,input.kind==='voice'?input.durationMs??null:null,key,chatHash(bytes),fingerprint])).rows[0];
    return {row,existing:false};
  });
  if(reserved.existing)return {attachment:attachmentView(reserved.row),deduplicated:true};
  try{
    await storage.put(reserved.row.storage_key,bytes,mimeType);
    return await workspaceTransaction(user,async client=>{
      await chatAccess(client,user,input.teamId);
      const row=(await client.query<AttachmentRow>(`UPDATE workspace_chat_attachments SET status='ready' WHERE id=$1 AND user_id=$2 AND status='staging' AND storage_key=$3 AND sha256=$4 RETURNING *`,[reserved.row.id,user.id,reserved.row.storage_key,reserved.row.sha256])).rows[0];
      if(!row)throw new ChatError('upload_pending',409);
      return {attachment:attachmentView(row),deduplicated:false};
    });
  }catch(error){
    // Best effort only for this newly staged key; finalized attachments are never removed here.
    try{await storage.delete(reserved.row.storage_key);await workspaceTransaction(user,async client=>{await client.query(`UPDATE workspace_chat_attachments SET status='failed' WHERE id=$1 AND user_id=$2 AND status='staging' AND storage_key=$3 AND sha256=$4`,[reserved.row.id,user.id,reserved.row.storage_key,reserved.row.sha256]);});}catch{/* Durable staging row retains its quota reservation for review. */}
    throw error;
  }
}
/** Only unattached transient uploads are eligible; a failed deletion keeps its reservation. */
export async function discardChatAttachment(user:WorkspaceUser,id:string,storage:StorageAdapter=mediaStorage,expiredOnly=false){
  uuid.parse(id);
  return workspaceTransaction(user,async client=>{
    const row=(await client.query<AttachmentRow>(`SELECT * FROM workspace_chat_attachments a WHERE a.id=$1 AND a.user_id=$2 AND a.status IN ('ready','staging')
      AND NOT EXISTS(SELECT 1 FROM workspace_chat_messages m WHERE m.attachment_id=a.id)
      AND ($3::boolean=false AND a.status='ready' OR a.expires_at<now()) FOR UPDATE`,[id,user.id,expiredOnly])).rows[0];
    if(!row)throw new ChatError('attachment_unavailable',409);
    await chatAccess(client,user,row.team_id);
    await storage.delete(row.storage_key);
    await client.query(`UPDATE workspace_chat_attachments SET status='failed' WHERE id=$1 AND user_id=$2`,[id,user.id]);
    return {discarded:true};
  });
}
export async function cleanupChatAttachments(user:WorkspaceUser,teamId:string,storage:StorageAdapter=mediaStorage,preferredRequest?:string){
  const ids=await workspaceTransaction(user,async client=>{
    await chatAccess(client,user,teamId);
    return (await client.query<{id:string}>(`SELECT a.id FROM workspace_chat_attachments a WHERE a.team_id=$1 AND a.user_id=$2 AND a.status IN ('ready','staging') AND a.expires_at<now()
      AND NOT EXISTS(SELECT 1 FROM workspace_chat_messages m WHERE m.attachment_id=a.id)
      ORDER BY (a.request_id=$3::uuid) DESC,a.created_at LIMIT 2`,[teamId,user.id,preferredRequest??null])).rows.map(row=>row.id);
  });
  let cleaned=0;for(const id of ids){try{await discardChatAttachment(user,id,storage,true);cleaned++;}catch{/* Keep durable row and quota if private storage could not be cleaned. */}}return {cleaned};
}
export async function readChatAttachment(user:WorkspaceUser,id:string,storage:StorageAdapter=mediaStorage){
  uuid.parse(id);
  const row=await workspaceTransaction(user,async client=>{
    const item=(await client.query<AttachmentRow>(`SELECT a.* FROM workspace_chat_attachments a WHERE a.id=$1 AND
      (a.status='attached' AND EXISTS(SELECT 1 FROM workspace_chat_messages m WHERE m.attachment_id=a.id AND m.team_id=a.team_id)
       OR a.status='ready' AND a.user_id=$2 AND a.expires_at>now())`,[id,user.id])).rows[0];
    if(!item)throw new ChatError('not_found',404);await chatAccess(client,user,item.team_id);return item;
  });
  const bytes=await storage.get(row.storage_key);if(!bytes||chatHash(bytes)!==row.sha256)throw new ChatError('attachment_unavailable',503);
  return {bytes,mimeType:row.mime_type,sizeBytes:Number(row.size_bytes)};
}

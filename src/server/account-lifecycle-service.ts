import {z} from 'zod';
import type {PoolClient} from 'pg';
import {pool} from '@/db';
import {AccountError,accountHash} from './account-contract';
import {verifyPassword} from './auth';
import type {StorageAdapter} from './storage';

const password=z.string().min(1).max(128),id=z.string().uuid();
export const lifecycleCommand=z.discriminatedUnion('action',[
 z.object({action:z.literal('preview_team'),teamId:id}).strict(),
 z.object({action:z.literal('request_team'),teamId:id,confirmation:z.string().max(254),password}).strict(),
 z.object({action:z.literal('cancel_team'),requestId:id,password}).strict(),
 z.object({action:z.literal('request_account'),confirmation:z.string().max(254),password}).strict(),
 z.object({action:z.literal('cancel_account'),requestId:id,password}).strict(),
]);
type Identity={userId:string;sessionHash:string};
export type LifecycleStatus={graceDays:number;account:{state:'active'|'pending'|'purging';requestId:string|null;purgeAfter:string|null;canCancel:boolean;blockingTeams:Array<{id:string;name:string}>};teams:Array<{id:string;name:string;role:string;state:'active'|'pending'|'purging';requestId:string|null;purgeAfter:string|null;canRequest:boolean;canCancel:boolean}>};
function lifecycleError(error:unknown){if(error instanceof AccountError)return error;const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';
 return new AccountError(code==='42501'?'forbidden':code==='23514'?'lifecycle_last_lead':code==='40001'||code==='23505'?'lifecycle_busy':code==='22023'?'confirmation_mismatch':'service_unavailable',code==='42501'?403:code==='23514'||code==='40001'||code==='23505'?409:code==='22023'?422:503);}
async function withIdentity<T>(identity:Identity,work:(client:PoolClient,passwordHash:string)=>Promise<T>){const client=await pool.connect();try{
 await client.query('BEGIN');await client.query("SELECT set_config('app.user_id',$1,true),set_config('statement_timeout','15000',true),set_config('lock_timeout','5000',true)",[identity.userId]);
 const row=(await client.query<{password_hash:string}>(`SELECT u.password_hash FROM users u JOIN account_verification v ON v.user_id=u.id AND v.verified_at IS NOT NULL JOIN sessions s ON s.user_id=u.id AND s.id=$2 AND s.expires_at>now() WHERE u.id=$1`,[identity.userId,identity.sessionHash])).rows[0];
 if(!row)throw new AccountError('unauthenticated',401);const result=await work(client,row.password_hash);await client.query('COMMIT');return result;
 }catch(error){await client.query('ROLLBACK');throw lifecycleError(error);}finally{client.release();}}
export async function getAccountLifecycle(identity:Identity):Promise<LifecycleStatus>{return withIdentity(identity,async client=>(await client.query<{value:LifecycleStatus}>('SELECT public.workspace_lifecycle_status() AS value')).rows[0].value);}
export async function manageAccountLifecycle(identity:Identity,raw:unknown){const input=lifecycleCommand.parse(raw);
 if(input.action!=='preview_team'){
  const rate=(await pool.query<{attempts:number}>(`INSERT INTO account_rate_limits(key_hash,window_started_at,attempts) VALUES($1,now(),1) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN account_rate_limits.window_started_at<now()-interval '15 minutes' THEN 1 ELSE account_rate_limits.attempts+1 END,window_started_at=CASE WHEN account_rate_limits.window_started_at<now()-interval '15 minutes' THEN now() ELSE account_rate_limits.window_started_at END RETURNING attempts`,[accountHash('lifecycle:'+identity.userId)])).rows[0];
  if(rate.attempts>8)throw new AccountError('rate_limited',429);
 }
 return withIdentity(identity,async(client,hash)=>{
  if(input.action==='preview_team')return {preview:(await client.query('SELECT public.workspace_lifecycle_preview($1) AS value',[input.teamId])).rows[0].value};
  if(!await verifyPassword(input.password,hash))throw new AccountError('invalid_password',403);
  const target=input.action==='request_team'?input.teamId:input.action==='request_account'?identity.userId:input.requestId;
  const status=(await client.query<{value:LifecycleStatus}>('SELECT public.workspace_lifecycle_manage($1,$2,$3,$4) AS value',[input.action,target,'confirmation'in input?input.confirmation:'',identity.sessionHash])).rows[0].value;
  return {ok:true,...status};
 });}
type Claim={id:string;kind:'team'|'account';target_id:string;claim_token:string};
/** Only an authenticated scheduler may call this. Object removal uses committed exact keys, never prefixes. */
export async function runLifecyclePurge(storage:StorageAdapter){const claims=(await pool.query<Claim>('SELECT id,kind,target_id,claim_token FROM public.workspace_lifecycle_claim()')).rows;let purged=0,failed=0,remaining=0;
 for(const claim of claims){const removed:string[]=[];let errorCode:string|null=null;
  try{const prepared=(await pool.query<{value:{ready:boolean;keys:string[]}}>('SELECT public.workspace_lifecycle_prepare($1,$2) AS value',[claim.id,claim.claim_token])).rows[0].value;
   if(!prepared.ready){failed++;continue;}
   for(const key of prepared.keys.slice(0,4)){const team=/^(?:chat\/)?([a-f0-9-]{36})\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/i.exec(key)?.[1]?.toLowerCase();if(!team||key.split('/').some(part=>part==='.'||part==='..')||(claim.kind==='team'&&team!==claim.target_id))throw new Error('unsafe cleanup manifest');
    try{await storage.delete(key);removed.push(key);}catch{errorCode='storage_cleanup_failed';break;}}
  }catch{errorCode='lifecycle_prepare_failed';}
  try{const result=(await pool.query<{value:{purged:boolean;remaining:number}}>('SELECT public.workspace_lifecycle_ack($1,$2,$3,$4) AS value',[claim.id,claim.claim_token,JSON.stringify(removed),errorCode])).rows[0].value;
   if(result.purged)purged++;remaining+=result.remaining;if(errorCode)failed++;
  }catch{failed++;}
 }
 const blocked=Number((await pool.query<{count:string}>("SELECT public.workspace_lifecycle_blocked_count()::text AS count")).rows[0].count);
 return {processed:claims.length,purged,failed,remaining,blocked};
}

import {pool} from '@/db';
import type {StorageAdapter} from './storage';

/** Registered lifecycle fence. A committed unresolved write pauses erasure until explicitly resolved. */
export function withLifecycleStorage(adapter:StorageAdapter):StorageAdapter{
 async function access<T>(key:string,writing:boolean,work:()=>Promise<T>){const team=/^(?:chat\/)?([a-f0-9-]{36})\//i.exec(key)?.[1]?.toLowerCase();if(!team)return work();
  if(writing){
   // Commits BEFORE external I/O. Lost connections/errors keep this unresolved
   // writer and pause erasure; no elapsed-time success assumption is made.
   const writer=(await pool.query<{id:string}>('SELECT public.workspace_lifecycle_begin_write($1) AS id',[key])).rows[0].id;
   const result=await work();
   const allowed=(await pool.query<{allowed:boolean}>('SELECT public.workspace_lifecycle_finish_write($1) AS allowed',[writer])).rows[0].allowed;
   if(!allowed)throw new Error('lifecycle_storage_closed');return result;
  }
  const client=await pool.connect();try{await client.query('BEGIN');await client.query("SELECT set_config('statement_timeout','90000',true),set_config('idle_in_transaction_session_timeout','90000',true)");
   await client.query("SELECT pg_advisory_xact_lock(hashtextextended('lifecycle-storage:'||$1,0))",[team]);
   const allowed=(await client.query<{allowed:boolean}>('SELECT public.workspace_lifecycle_storage_open($1,$2) AS allowed',[key,false])).rows[0].allowed;
   if(!allowed)throw new Error('lifecycle_storage_closed');const result=await work();
   if(!(await client.query<{allowed:boolean}>('SELECT public.workspace_lifecycle_storage_open($1,$2) AS allowed',[key,false])).rows[0].allowed)throw new Error('lifecycle_storage_closed');
   await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}}
 return{put:(key,bytes,type)=>access(key,true,()=>adapter.put(key,bytes,type)),get:key=>access(key,false,()=>adapter.get(key)),delete:key=>adapter.delete(key),deletePrefix:async()=>{throw new Error('bulk_delete_requires_review');}};
}

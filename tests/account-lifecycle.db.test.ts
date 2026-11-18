import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {Pool} from 'pg';
import {randomUUID,randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {accountHash} from '@/server/account-contract';
import type {WorkspaceUser} from '@/server/workspace-service';
import type {StorageAdapter} from '@/server/storage';

const enabled=process.env.RUN_LIFECYCLE_DB_TESTS==='true';
describe.skipIf(!enabled)('Registered lifecycle migration in a new empty database',()=>{
 const admin=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
 const users:WorkspaceUser[]=Array.from({length:3},(_,i)=>({id:randomUUID(),displayName:'Lifecycle experiment '+i,locale:'en'}));
 const [lead,otherLead,outsider]=users,sessionHash=accountHash(randomBytes(32).toString('base64url'));let teamId:string,projectId:string,artifactId:string,connectionId:string,teamRequest:string,accountRequest:string;
 let workspace:typeof import('@/server/workspace-service'),media:typeof import('@/server/workspace-media-service'),team:typeof import('@/server/workspace-team-service'),chat:typeof import('@/server/workspace-chat-service');
 let lifecycle:typeof import('@/server/account-lifecycle-service'),guarded:StorageAdapter;const password='Synthetic-only-password-2026';
 const objects=new Map<string,Buffer>(),storage:StorageAdapter={put:async(key,bytes)=>{objects.set(key,bytes);},get:async key=>objects.get(key)||null,delete:async key=>{objects.delete(key);},deletePrefix:async()=>{throw new Error('Never use prefix cleanup');}};
 const cmd=(user:WorkspaceUser,command:string,args:unknown[],extra={})=>workspace.executeWorkspaceCommand(user,{command,args,requestId:randomUUID(),...extra});
 beforeAll(async()=>{
  const name=(await admin.query('SELECT current_database() AS name')).rows[0].name;if(!/^tracelab_unified_test_[0-9]+_[a-f0-9]{8}$/.test(name))throw new Error('Fresh isolated database required.');
  workspace=await import('@/server/workspace-service');media=await import('@/server/workspace-media-service');team=await import('@/server/workspace-team-service');chat=await import('@/server/workspace-chat-service');lifecycle=await import('@/server/account-lifecycle-service');guarded=(await import('@/server/account-lifecycle-storage')).withLifecycleStorage(storage);
  const runtime=(await (await import('@/db')).pool.query('SELECT current_database() AS name,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
  if(runtime.name!==name||runtime.rolsuper||runtime.rolbypassrls)throw new Error('Restricted runtime on the same new DB required.');
  const hash=await (await import('@/server/auth')).hashPassword(password);
  for(const user of users){await admin.query("INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,$3,$4)",[user.id,user.id+'@example.invalid',hash,user.displayName]);await admin.query('INSERT INTO account_verification(user_id,verified_at) VALUES($1,now())',[user.id]);}
  await admin.query("INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[sessionHash,lead.id]);
  const state=await cmd(lead,'createTeam',[{name:'Lifecycle synthetic team',project:'Synthetic mechanism',season:'2026',timezone:'UTC',program:'OTHER',locale:'en'}]);teamId=state.team!.id;projectId=state.activeProjectId!;
  await admin.query("INSERT INTO team_memberships(team_id,user_id,role) VALUES($1,$2,'student_lead')",[teamId,otherLead.id]);
  const bytes=await sharp({create:{width:16,height:16,channels:3,background:'#d56e52'}}).png().toBuffer();
  artifactId=(await media.uploadWorkspaceMedia(lead,{teamId,projectId,requestId:randomUUID(),kind:'photo',name:'Unchanged experiment photo',filename:'fixture.png',caption:'Original fixture rationale',alt:'Fixture only',occurredAt:new Date().toISOString()},bytes,{storage})).artifactId!;
  connectionId=randomUUID();await admin.query("INSERT INTO source_connections(id,team_id,provider,external_id,label,status,encrypted_secret,config,created_by) VALUES($1,$2,'github','fixture/repository','Synthetic webhook','pending','fixture-secret',jsonb_build_object('workspaceMode','repository-webhook','workspaceProjectId',$3::text),$4)",[connectionId,teamId,projectId,lead.id]);
  await admin.query("INSERT INTO team_invites(team_id,code,role,expires_at,created_by) VALUES($1,'fixture-hash','student',now()+interval '1 day',$2)",[teamId,lead.id]);
 });
 afterAll(async()=>{await admin.end();}); // Preserve only this new synthetic DB as experimental evidence.
 it('baseline application reads work and a foreign account cannot read the team',async()=>{
  expect((await workspace.getWorkspace(lead,{team:teamId,project:projectId})).projects[0].records.some(record=>record.title==='Unchanged experiment photo')).toBe(true);
  expect((await media.readWorkspaceMedia(lead,artifactId,false,storage)).bytes.length).toBeGreaterThan(0);
  await expect(workspace.getWorkspace(outsider,{team:teamId,project:projectId})).rejects.toMatchObject({status:403});
 });
 it('a pending team closes real workspace/media/chat reads, writes, privileged settings and join paths',async()=>{
  teamRequest=(await admin.query("INSERT INTO workspace_lifecycle_requests(kind,target_id,requested_by) VALUES('team',$1,$2) RETURNING id",[teamId,lead.id])).rows[0].id;
  await expect(workspace.getWorkspace(lead,{team:teamId,project:projectId})).rejects.toMatchObject({status:403});
  await expect(media.readWorkspaceMedia(lead,artifactId,false,storage)).rejects.toBeDefined();
  await expect(media.listWorkspaceMedia(lead,{teamId,projectId})).rejects.toBeDefined();
  await expect(chat.listTeamChat(lead,teamId)).rejects.toBeDefined();
  await expect(cmd(lead,'addRecord',[{kind:'source',title:'Must not persist'}],{teamId,projectId,expectedRevision:1})).rejects.toBeDefined();
  await expect(team.manageWorkspaceTeam(lead,{command:'settings',teamId,name:'Forbidden rename',timezone:'UTC',locale:'en',expectedVersion:0})).rejects.toBeDefined();
  await expect(workspace.workspaceTransaction(outsider,client=>client.query("SELECT public.workspace_join_invite('fixture-hash')"))).rejects.toBeDefined();
  const credential=await workspace.workspaceTransaction(lead,client=>client.query('SELECT * FROM public.workspace_github_credential($1)',[connectionId]));expect(credential.rowCount).toBe(0);
  expect((await admin.query("SELECT count(*) AS count FROM source_events WHERE title='Must not persist'")).rows[0].count).toBe('0');
 });
 it('cancel restores access without rewriting the original evidence or bytes',async()=>{
  const before=[...objects.values()].map(bytes=>bytes.toString('hex'));
  await admin.query("UPDATE workspace_lifecycle_requests SET state='cancelled' WHERE id=$1",[teamRequest]);
  const state=await workspace.getWorkspace(lead,{team:teamId,project:projectId});expect(state.projects[0].records[0].body).toBe('Original fixture rationale');
  expect((await media.readWorkspaceMedia(lead,artifactId,false,storage)).bytes.length).toBeGreaterThan(0);expect([...objects.values()].map(bytes=>bytes.toString('hex'))).toEqual(before);
 });
 it('account pending blocks workspace/new-team operations, retains account cancellation access and protects the remaining active lead',async()=>{
  accountRequest=(await admin.query("INSERT INTO workspace_lifecycle_requests(kind,target_id,requested_by) VALUES('account',$1,$1) RETURNING id",[lead.id])).rows[0].id;
  await expect(workspace.getWorkspace(lead,{team:teamId,project:projectId})).rejects.toBeDefined();
  await expect(cmd(lead,'createTeam',[{name:'Blocked new team',project:'Blocked',season:'2026',timezone:'UTC',program:'OTHER',locale:'en'}])).rejects.toBeDefined();
  expect((await (await import('@/server/account-settings-service')).getAccountSettings({userId:lead.id,sessionHash})).profile.displayName).toBe(lead.displayName);
  expect((await (await import('@/server/account-service')).authenticateAccount({email:lead.id+'@example.invalid',password,next:'/workspace'}, {origin:'http://localhost:3000',previewKeyHash:null,rateIdentity:'lifecycle-fixture'})).next).toBe('/account');
  await expect(team.manageWorkspaceTeam(otherLead,{command:'changeMember',teamId,userId:otherLead.id,role:'student',status:'active',expectedRole:'student_lead',expectedStatus:'active'})).rejects.toBeDefined();
  await admin.query("UPDATE workspace_lifecycle_requests SET state='cancelled' WHERE id=$1",[accountRequest]);expect((await workspace.getWorkspace(lead,{team:teamId,project:projectId})).team!.id).toBe(teamId);
 });
 it('retired privileged helpers and intent writes cannot bypass the runtime boundary',async()=>{
  await expect(workspace.workspaceTransaction(outsider,client=>client.query("SELECT public.lifecycle_original_join_invite('fixture-hash')"))).rejects.toMatchObject({code:'42501'});
  await expect(workspace.workspaceTransaction(lead,client=>client.query("INSERT INTO workspace_lifecycle_requests(kind,target_id,requested_by) VALUES('team',$1,$2)",[teamId,lead.id]))).rejects.toMatchObject({code:'42501'});
  for(const signature of ['workspace_lifecycle_keys(uuid)','workspace_lifecycle_blocking_teams(uuid)','workspace_lifecycle_key_team(text)'])expect((await admin.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') AS allowed',[(await (await import('@/db')).pool.query('SELECT current_user AS role')).rows[0].role,'public.'+signature])).rows[0].allowed).toBe(false);
 });
 it('the service requires current password/role/confirmation, enforces seven days, and cancel restores guarded bytes',async()=>{
  const identity={userId:lead.id,sessionHash};const preview=await lifecycle.manageAccountLifecycle(identity,{action:'preview_team',teamId});expect('preview'in preview&&preview.preview.fileCount).toBe(2);
  await expect(lifecycle.manageAccountLifecycle(identity,{action:'preview_team',teamId:randomUUID()})).rejects.toMatchObject({code:'forbidden'});
  await expect(lifecycle.manageAccountLifecycle(identity,{action:'request_team',teamId,confirmation:'Lifecycle synthetic team',password:'wrong'})).rejects.toMatchObject({code:'invalid_password'});
  await expect(lifecycle.manageAccountLifecycle(identity,{action:'request_team',teamId,confirmation:'wrong name',password})).rejects.toMatchObject({code:'confirmation_mismatch'});
  const pending=await lifecycle.manageAccountLifecycle(identity,{action:'request_team',teamId,confirmation:'Lifecycle synthetic team',password});if(!('teams'in pending))throw new Error('Expected status');
  const item=pending.teams.find(t=>t.id===teamId)!;expect(item.state).toBe('pending');expect(item.canCancel).toBe(true);expect(new Date(item.purgeAfter!).getTime()-Date.now()).toBeGreaterThan(6.99*86400000);
  expect(await lifecycle.runLifecyclePurge(storage)).toMatchObject({processed:0,purged:0});
  const key=(await admin.query('SELECT storage_key FROM artifacts WHERE id=$1',[artifactId])).rows[0].storage_key;await expect(guarded.get(key)).rejects.toThrow('lifecycle_storage_closed');await expect(guarded.put(key,Buffer.from('must not replace'),'image/png')).rejects.toThrow('lifecycle_storage_closed');
  await lifecycle.manageAccountLifecycle(identity,{action:'cancel_team',requestId:item.requestId,password});expect((await guarded.get(key))!.length).toBeGreaterThan(0);
  expect((await lifecycle.getAccountLifecycle(identity)).teams.find(t=>t.id===teamId)!.state).toBe('active');
 });
 async function newAccount(label:string){const user:WorkspaceUser={id:randomUUID(),displayName:label,locale:'en'},hash=await (await import('@/server/auth')).hashPassword(password),session=accountHash(randomBytes(32).toString('base64url'));
  await admin.query('INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,$3,$4)',[user.id,user.id+'@example.invalid',hash,label]);await admin.query('INSERT INTO account_verification(user_id,verified_at) VALUES($1,now())',[user.id]);await admin.query("INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[session,user.id]);return{user,identity:{userId:user.id,sessionHash:session}};
 }
 async function newTeam(user:WorkspaceUser,name:string){const state=await cmd(user,'createTeam',[{name,project:'Disposable mechanism',season:'2026',timezone:'UTC',program:'OTHER',locale:'en'}]);return{teamId:state.team!.id,projectId:state.activeProjectId!};}
 it('two leads cannot concurrently close both accounts, and the remaining lead cannot demote itself',async()=>{
  const a=await newAccount('Concurrency lead A'),b=await newAccount('Concurrency lead B'),t=await newTeam(a.user,'Concurrency synthetic team');await admin.query("INSERT INTO team_memberships(team_id,user_id,role) VALUES($1,$2,'student_lead')",[t.teamId,b.user.id]);
  const results=await Promise.allSettled([a,b].map(person=>lifecycle.manageAccountLifecycle(person.identity,{action:'request_account',confirmation:person.user.id+'@example.invalid',password})));
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(results.filter(result=>result.status==='rejected').map(result=>result.status==='rejected'&&result.reason.code)).toEqual(['lifecycle_last_lead']);
  const index=results.findIndex(result=>result.status==='fulfilled'),closing=[a,b][index],remaining=[a,b][1-index];
  await expect(team.manageWorkspaceTeam(remaining.user,{command:'changeMember',teamId:t.teamId,userId:remaining.user.id,role:'student',status:'active',expectedRole:'student_lead',expectedStatus:'active'})).rejects.toBeDefined();
  const status=await lifecycle.getAccountLifecycle(closing.identity);await lifecycle.manageAccountLifecycle(closing.identity,{action:'cancel_account',requestId:status.account.requestId!,password});expect((await workspace.getWorkspace(closing.user,{team:t.teamId,project:t.projectId})).team!.id).toBe(t.teamId);
 });
 it('account purge removes account access/chat/transient bytes while preserving team evidence and ready report bytes',async()=>{
  const closing=await newAccount('Closing synthetic author'),keeper=await newAccount('Remaining synthetic lead'),t=await newTeam(keeper.user,'Retained synthetic team');await admin.query("INSERT INTO team_memberships(team_id,user_id,role) VALUES($1,$2,'student_lead')",[t.teamId,closing.user.id]);
  const png=await sharp({create:{width:16,height:16,channels:3,background:'#649286'}}).png().toBuffer();const photo=await media.uploadWorkspaceMedia(closing.user,{...t,requestId:randomUUID(),kind:'photo',name:'Retained team evidence',filename:'evidence.png',caption:'Unmodified engineering rationale',alt:'fixture',occurredAt:new Date().toISOString()},png,{storage:guarded});
  const attachment=(await chat.uploadChatAttachment(closing.user,{teamId:t.teamId,requestId:randomUUID(),kind:'photo',filename:'chat.png',mimeType:'image/png'},png,guarded)).attachment;await chat.sendTeamChat(closing.user,{teamId:t.teamId,requestId:randomUUID(),text:'Account-only chat',attachmentId:attachment.id});
  const chatKey=(await admin.query('SELECT storage_key FROM workspace_chat_attachments WHERE id=$1',[attachment.id])).rows[0].storage_key,reportKey=t.teamId+'/exports/retained.json',transientKey=t.teamId+'/uploads/transient/source.png',reportId=randomUUID();objects.set(reportKey,Buffer.from('ready team report'));objects.set(transientKey,png);
  await admin.query("INSERT INTO exports(id,team_id,type,created_by,status,storage_key) VALUES($1,$2,'team_data',$3,'ready',$4)",[reportId,t.teamId,closing.user.id,reportKey]);await admin.query("INSERT INTO workspace_uploads(id,user_id,request_id,team_id,project_id,payload_hash,reserved_bytes,storage_keys) VALUES($1,$2,$3,$4,$5,'fixture',10,$6)",[randomUUID(),closing.user.id,randomUUID(),t.teamId,t.projectId,JSON.stringify([transientKey])]);
  const pending=await lifecycle.manageAccountLifecycle(closing.identity,{action:'request_account',confirmation:closing.user.id+'@example.invalid',password});if(!('account'in pending))throw new Error('Expected status');
  await expect(guarded.put(chatKey,png,'image/png')).rejects.toThrow('lifecycle_storage_closed');expect((await guarded.get(reportKey))!.toString()).toBe('ready team report');
  await admin.query("UPDATE workspace_lifecycle_requests SET purge_after=now()-interval '1 second' WHERE id=$1",[pending.account.requestId]);const accountClaim=(await admin.query('SELECT * FROM workspace_lifecycle_claim()')).rows[0];await admin.query('SELECT workspace_lifecycle_prepare($1,$2)',[accountClaim.id,accountClaim.claim_token]);await admin.query("UPDATE workspace_lifecycle_requests SET lease_until=now()-interval '1 second' WHERE id=$1",[accountClaim.id]);expect(await lifecycle.runLifecyclePurge(storage)).toMatchObject({processed:1,purged:1,failed:0,remaining:0});
  expect(objects.has(chatKey)).toBe(false);expect(objects.has(transientKey)).toBe(false);expect(objects.has(reportKey)).toBe(true);expect((await admin.query('SELECT count(*) FROM workspace_chat_messages WHERE user_id=$1',[closing.user.id])).rows[0].count).toBe('0');
  expect((await admin.query('SELECT email,password_hash,display_name FROM users WHERE id=$1',[closing.user.id])).rows[0]).toMatchObject({email:'closed-'+closing.user.id+'@accounts.invalid',display_name:'Closed account'});expect((await admin.query('SELECT count(*) FROM sessions WHERE user_id=$1',[closing.user.id])).rows[0].count).toBe('0');
  expect((await media.readWorkspaceMedia(keeper.user,photo.artifactId!,false,guarded)).bytes.length).toBeGreaterThan(0);expect((await workspace.getWorkspace(keeper.user,{team:t.teamId,project:t.projectId})).projects[0].records.some(record=>record.body==='Unmodified engineering rationale')).toBe(true);
  await expect(lifecycle.getAccountLifecycle(closing.identity)).rejects.toMatchObject({code:'unauthenticated'});
 });
 it('a committed in-flight write blocks purge even when completion journaling fails, then safely resumes',async()=>{
  const account=await newAccount('In-flight synthetic writer'),t=await newTeam(account.user,'In-flight synthetic team'),key=t.teamId+'/uploads/inflight/source.png',bytes=Buffer.from('eventual private bytes');
  await admin.query("INSERT INTO workspace_uploads(id,user_id,request_id,team_id,project_id,payload_hash,reserved_bytes,storage_keys) VALUES($1,$2,$3,$4,$5,'fixture',100,$6)",[randomUUID(),account.user.id,randomUUID(),t.teamId,t.projectId,JSON.stringify([key])]);
  let finish!:()=>void,started!:()=>void;const began=new Promise<void>(resolve=>{started=resolve;}),release=new Promise<void>(resolve=>{finish=resolve;});const delayed=(await import('@/server/account-lifecycle-storage')).withLifecycleStorage({...storage,put:async(k,value)=>{started();await release;objects.set(k,value);}});
  const writing=delayed.put(key,bytes,'image/png');await began;expect((await admin.query('SELECT count(*) FROM workspace_lifecycle_storage_writes WHERE key=$1',[key])).rows[0].count).toBe('1');
  const pending=await lifecycle.manageAccountLifecycle(account.identity,{action:'request_team',teamId:t.teamId,confirmation:'In-flight synthetic team',password});if(!('teams'in pending))throw new Error('Expected status');const request=pending.teams[0].requestId;await admin.query("UPDATE workspace_lifecycle_requests SET purge_after=now()-interval '1 second' WHERE id=$1",[request]);expect(await lifecycle.runLifecyclePurge(storage)).toMatchObject({processed:1,purged:0,failed:1});
  const runtime=(await import('@/db')).pool,original=runtime.query.bind(runtime),spy=vi.spyOn(runtime,'query');spy.mockImplementation(((...args:unknown[])=>String(args[0]).includes('workspace_lifecycle_finish_write')?Promise.reject(new Error('simulated completion DB outage')):Reflect.apply(original,undefined,args)) as typeof runtime.query);
  finish();await expect(writing).rejects.toThrow('simulated completion DB outage');spy.mockRestore();expect(objects.get(key)).toEqual(bytes);expect((await admin.query('SELECT count(*) FROM teams WHERE id=$1',[t.teamId])).rows[0].count).toBe('1');
  await admin.query("UPDATE workspace_lifecycle_requests SET next_attempt_at=now()-interval '1 second' WHERE id=$1",[request]);expect(await lifecycle.runLifecyclePurge(storage)).toMatchObject({processed:1,purged:0});expect((await admin.query('SELECT state,last_error FROM workspace_lifecycle_requests WHERE id=$1',[request])).rows[0]).toEqual({state:'pending',last_error:'lifecycle_write_pending'});
  const writer=(await admin.query('SELECT id FROM workspace_lifecycle_storage_writes WHERE key=$1',[key])).rows[0].id;expect((await runtime.query('SELECT workspace_lifecycle_finish_write($1) AS allowed',[writer])).rows[0].allowed).toBe(false);await admin.query("UPDATE workspace_lifecycle_requests SET next_attempt_at=now()-interval '1 second' WHERE id=$1",[request]);expect(await lifecycle.runLifecyclePurge(storage)).toMatchObject({processed:1,purged:1,failed:0});expect(objects.has(key)).toBe(false);
 });
 it('purge keeps an exact durable manifest, rejects NULL receipts, recovers leases and retries bounded file batches',async()=>{
  const png=await sharp({create:{width:16,height:16,channels:3,background:'#747bb1'}}).png().toBuffer();for(let index=0;index<2;index++)await media.uploadWorkspaceMedia(lead,{teamId,projectId,requestId:randomUUID(),kind:'photo',name:'Purge fixture '+index,filename:'fixture.png',caption:'Synthetic only',alt:'fixture',occurredAt:new Date().toISOString()},png,{storage:guarded});
  const upperKeys=[teamId.toUpperCase()+'/uploads/Upper/source.png',teamId.toUpperCase()+'/uploads/Upper/thumbnail.webp'];await admin.query("INSERT INTO workspace_uploads(id,user_id,request_id,team_id,project_id,payload_hash,reserved_bytes,storage_keys) VALUES($1,$2,$3,$4,$5,'fixture',1000,$6)",[randomUUID(),lead.id,randomUUID(),teamId,projectId,JSON.stringify(upperKeys)]);for(const key of upperKeys)await guarded.put(key,png,'image/png');
  const chatAttachment=(await chat.uploadChatAttachment(lead,{teamId,requestId:randomUUID(),kind:'photo',filename:'chat.png',mimeType:'image/png'},png,guarded)).attachment;await chat.sendTeamChat(lead,{teamId,requestId:randomUUID(),text:'Synthetic team chat',attachmentId:chatAttachment.id});
  const foreignKey=randomUUID()+'/uploads/keep/source.png';objects.set(foreignKey,Buffer.from('untouched foreign fixture'));
  const requested=await lifecycle.manageAccountLifecycle({userId:lead.id,sessionHash},{action:'request_team',teamId,confirmation:'Lifecycle synthetic team',password});if(!('teams'in requested))throw new Error('Expected status');const request=requested.teams.find(t=>t.id===teamId)!.requestId;
  await admin.query("UPDATE workspace_lifecycle_requests SET purge_after=now()-interval '1 second' WHERE id=$1",[request]);const claim=(await admin.query('SELECT * FROM workspace_lifecycle_claim()')).rows[0];const prepared=(await admin.query('SELECT workspace_lifecycle_prepare($1,$2) AS value',[claim.id,claim.claim_token])).rows[0].value;expect(prepared.ready).toBe(true);expect(prepared.keys).toHaveLength(9);expect(prepared.keys.some((key:string)=>key.startsWith(teamId.toUpperCase()))).toBe(true);
  expect((await admin.query('SELECT count(*) FROM teams WHERE id=$1',[teamId])).rows[0].count).toBe('0');expect(prepared.keys.every((key:string)=>objects.has(key))).toBe(true);
  await expect(admin.query('SELECT workspace_lifecycle_ack($1,$2,NULL,NULL)',[claim.id,claim.claim_token])).rejects.toMatchObject({code:'22023'});expect((await admin.query('SELECT cleanup_keys,state FROM workspace_lifecycle_requests WHERE id=$1',[request])).rows[0]).toEqual({cleanup_keys:prepared.keys,state:'purging'});
  // A delete receipt cannot acknowledge a newer late-write generation.
  const racing=prepared.keys[0];await storage.delete(racing);objects.set(racing,Buffer.from('late completion before old ACK'));await (await import('@/db')).pool.query('SELECT workspace_lifecycle_late_key($1)',[racing]);await expect(admin.query('SELECT workspace_lifecycle_ack($1,$2,$3,NULL)',[claim.id,claim.claim_token,JSON.stringify([racing])])).rejects.toMatchObject({code:'42501'});expect((await admin.query('SELECT cleanup_keys FROM workspace_lifecycle_requests WHERE id=$1',[request])).rows[0].cleanup_keys).toEqual(prepared.keys);
  await admin.query('SELECT * FROM workspace_lifecycle_claim()');expect(await lifecycle.runLifecyclePurge(storage)).toMatchObject({processed:0});await admin.query("UPDATE workspace_lifecycle_requests SET lease_until=now()-interval '1 second' WHERE id=$1",[request]);
  let attempts=0;const intermittent:StorageAdapter={...storage,delete:async key=>{if(++attempts===2)throw new Error('private provider detail must not escape');await storage.delete(key);}};expect(await lifecycle.runLifecyclePurge(intermittent)).toMatchObject({processed:1,failed:1,remaining:8});
  expect((await admin.query('SELECT last_error FROM workspace_lifecycle_requests WHERE id=$1',[request])).rows[0].last_error).toBe('storage_cleanup_failed');await admin.query("UPDATE workspace_lifecycle_requests SET next_attempt_at=now()-interval '1 second' WHERE id=$1",[request]);expect(await lifecycle.runLifecyclePurge(storage)).toMatchObject({processed:1,remaining:4,purged:0});
  await admin.query("UPDATE workspace_lifecycle_requests SET next_attempt_at=now()-interval '1 second' WHERE id=$1",[request]);expect(await lifecycle.runLifecyclePurge(storage)).toMatchObject({processed:1,remaining:0,purged:1});expect(objects.get(foreignKey)!.toString()).toBe('untouched foreign fixture');for(const key of prepared.keys)expect(objects.has(key)).toBe(false);
  const late=prepared.keys[0];objects.set(late,Buffer.from('late finished write'));await (await import('@/db')).pool.query('SELECT workspace_lifecycle_late_key($1)',[late]);expect((await admin.query('SELECT state,cleanup_keys FROM workspace_lifecycle_requests WHERE id=$1',[request])).rows[0]).toEqual({state:'purging',cleanup_keys:[late]});expect(await lifecycle.runLifecyclePurge(storage)).toMatchObject({processed:1,purged:1});expect(objects.has(late)).toBe(false);await expect(guarded.get(late)).rejects.toThrow('lifecycle_storage_closed');
 });
 it('a foreign cleanup key fails closed before DB deletion, retries five times, and stops for operator review',async()=>{
  const account=await newAccount('Unsafe manifest fixture'),t=await newTeam(account.user,'Unsafe manifest synthetic team'),foreign=randomUUID()+'/uploads/keep/source.png';objects.set(foreign,Buffer.from('must survive'));
  const status=await lifecycle.manageAccountLifecycle(account.identity,{action:'request_team',teamId:t.teamId,confirmation:'Unsafe manifest synthetic team',password});if(!('teams'in status))throw new Error('Expected status');const request=status.teams[0].requestId;await admin.query("UPDATE workspace_lifecycle_requests SET purge_after=now()-interval '1 second',cleanup_keys=$2 WHERE id=$1",[request,JSON.stringify([foreign])]);
  for(let attempt=0;attempt<5;attempt++){await admin.query("UPDATE workspace_lifecycle_requests SET next_attempt_at=now()-interval '1 second' WHERE id=$1",[request]);expect(await lifecycle.runLifecyclePurge(storage)).toMatchObject({processed:1,failed:1});}
  expect(await lifecycle.runLifecyclePurge(storage)).toMatchObject({processed:0,blocked:1});expect((await admin.query('SELECT count(*) FROM teams WHERE id=$1',[t.teamId])).rows[0].count).toBe('1');expect(objects.get(foreign)!.toString()).toBe('must survive');
 });
});

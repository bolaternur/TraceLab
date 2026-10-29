import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import type {WorkspaceUser} from '@/server/workspace-service';
import type {StorageAdapter} from '@/server/storage';
let workspace:typeof import('@/server/workspace-service'),chat:typeof import('@/server/workspace-chat-service'),calls:typeof import('@/server/workspace-chat-calls');
describe.skipIf(process.env.RUN_WORKSPACE_CHAT_DB_TESTS!=='true'||!process.env.DATABASE_URL||!process.env.DATABASE_MIGRATION_URL)('private team conversation and signaling',()=>{
  const admin=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
  const users:WorkspaceUser[]=Array.from({length:9},(_,index)=>({id:randomUUID(),displayName:`Chat fixture ${index}`,locale:'ru'}));
  const [lead,member,coach,outsider]=users;let teamId:string,projectId:string;
  const objects=new Map<string,Buffer>();
  const storage:StorageAdapter={put:async(key,bytes)=>{objects.set(key,bytes);},get:async key=>objects.get(key)||null,delete:async key=>{objects.delete(key);},deletePrefix:async()=>{throw new Error('not used');}};
  beforeAll(async()=>{
    workspace=await import('@/server/workspace-service');chat=await import('@/server/workspace-chat-service');calls=await import('@/server/workspace-chat-calls');
    const db=(await admin.query<{name:string}>('SELECT current_database() AS name')).rows[0].name;if(!db.startsWith('tracelab_unified_'))throw new Error('Isolated database required.');
    for(const user of users){await admin.query(`INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,'fixture-only',$3)`,[user.id,user.id+'@example.invalid',user.displayName]);await admin.query(`INSERT INTO account_verification(user_id,verified_at) VALUES($1,now())`,[user.id]);}
    const team=await workspace.executeWorkspaceCommand(lead,{command:'createTeam',requestId:randomUUID(),args:[{name:'Chat fixture',project:'Fixture',season:'2026',timezone:'Asia/Qyzylorda',program:'OTHER',locale:'ru'}]});teamId=team.team!.id;projectId=team.activeProjectId!;
    for(const user of users.filter(item=>item!==lead&&item!==outsider))await admin.query(`INSERT INTO team_memberships(team_id,user_id,role) VALUES($1,$2,$3)`,[teamId,user.id,user===coach?'coach':'student']);
  });
  afterAll(async()=>{if(teamId){await admin.query('DELETE FROM audit_events WHERE team_id=$1',[teamId]);await admin.query('DELETE FROM teams WHERE id=$1',[teamId]);}for(const user of users)await admin.query('DELETE FROM users WHERE id=$1',[user.id]);await admin.end();});
  it('shares authored messages across active members, paginates stably, and does not create graph records',async()=>{
    const request={teamId,requestId:randomUUID(),text:'Private team discussion'};
    const sent=await chat.sendTeamChat(lead,request),replay=await chat.sendTeamChat(lead,request);expect(replay.message.id).toBe(sent.message.id);expect(replay.deduplicated).toBe(true);
    await expect(chat.sendTeamChat(lead,{...request,text:'changed'})).rejects.toMatchObject({code:'request_conflict'});
    const reply=await chat.sendTeamChat(coach,{teamId,requestId:randomUUID(),text:'Coach may join conversation'});
    const list=await chat.listTeamChat(member,teamId,{after:sent.message.sequence});expect(list.items.map(item=>item.id)).toContain(reply.message.id);
    expect((await admin.query(`SELECT count(*)::integer AS n FROM workspace_entity_map WHERE project_id=$1`,[projectId])).rows[0].n).toBe(0);
    await expect(chat.listTeamChat(outsider,teamId)).rejects.toMatchObject({code:'forbidden'});
    await expect(chat.sendTeamChat(outsider,{teamId,requestId:randomUUID(),text:'No'})).rejects.toMatchObject({code:'forbidden'});
  });
  it('keeps clean photos private, binds attachments to their uploader, and shares after send',async()=>{
    const image=await sharp({create:{width:40,height:30,channels:3,background:'#aaccdd'}}).jpeg().toBuffer();
    const upload={teamId,requestId:randomUUID(),kind:'photo' as const,filename:'fixture.jpg',mimeType:'image/jpeg'};
    const attachment=(await chat.uploadChatAttachment(lead,upload,image,storage)).attachment;
    expect((await chat.uploadChatAttachment(lead,upload,image,storage)).attachment.id).toBe(attachment.id);
    await expect(chat.sendTeamChat(member,{teamId,requestId:randomUUID(),text:'',attachmentId:attachment.id})).rejects.toMatchObject({code:'attachment_unavailable'});
    await expect(chat.readChatAttachment(member,attachment.id,storage)).rejects.toMatchObject({code:'not_found'});
    await chat.sendTeamChat(lead,{teamId,requestId:randomUUID(),text:'Photo',attachmentId:attachment.id});
    const file=await chat.readChatAttachment(member,attachment.id,storage);expect(file.mimeType).toBe('image/png');expect((await sharp(file.bytes).metadata()).exif).toBeUndefined();
    await expect(chat.readChatAttachment(outsider,attachment.id,storage)).rejects.toMatchObject({code:'not_found'});
  });
  it('routes ephemeral call signals only to the intended active teammate and expires stale participants',async()=>{
    const a=randomUUID(),b=randomUUID();await calls.manageTeamCall(lead,{command:'join',teamId,participantId:a});await calls.manageTeamCall(member,{command:'join',teamId,participantId:b});
    await expect(calls.manageTeamCall(lead,{command:'join',teamId,participantId:randomUUID()})).rejects.toMatchObject({code:'already_in_call'});
    await calls.manageTeamCall(lead,{command:'signal',teamId,participantId:a,toParticipantId:b,type:'offer',payload:{type:'offer',sdp:'v=0\r\n'}});
    expect((await calls.pollTeamCall(member,teamId,b,'0')).signals).toHaveLength(1);expect((await calls.pollTeamCall(lead,teamId,a,'0')).signals).toHaveLength(0);
    await expect(calls.pollTeamCall(outsider,teamId,b,'0')).rejects.toMatchObject({code:'forbidden'});
    await expect(calls.pollTeamCall(lead,teamId,b,'0')).rejects.toMatchObject({code:'call_expired'});
    await calls.manageTeamCall(member,{command:'leave',teamId,participantId:b});
    await expect(calls.manageTeamCall(lead,{command:'signal',teamId,participantId:a,toParticipantId:b,type:'ice',payload:{candidate:'fixture'}})).rejects.toMatchObject({code:'participant_unavailable'});
    await admin.query(`UPDATE workspace_call_participants SET expires_at=now()-interval '1 second' WHERE id=$1`,[a]);
    await expect(calls.pollTeamCall(lead,teamId,a,'0')).rejects.toMatchObject({code:'call_expired'});
  });
  it('cleans only expired owner uploads, retains quota on storage failure and permits a safe identical retry',async()=>{
    const image=await sharp({create:{width:24,height:24,channels:3,background:'#cceedd'}}).png().toBuffer();
    const upload={teamId,requestId:randomUUID(),kind:'photo' as const,filename:'pending.png',mimeType:'image/png'};
    const item=(await chat.uploadChatAttachment(lead,upload,image,storage)).attachment;
    await expect(chat.discardChatAttachment(member,item.id,storage)).rejects.toMatchObject({code:'attachment_unavailable'});
    await admin.query(`UPDATE workspace_chat_attachments SET expires_at=now()-interval '1 second' WHERE id=$1`,[item.id]);
    const unavailable={...storage,delete:async()=>{throw new Error('synthetic storage failure');}};
    expect((await chat.cleanupChatAttachments(lead,teamId,unavailable)).cleaned).toBe(0);
    expect((await admin.query(`SELECT status FROM workspace_chat_attachments WHERE id=$1`,[item.id])).rows[0].status).toBe('ready');
    expect((await chat.cleanupChatAttachments(lead,teamId,storage)).cleaned).toBe(1);
    expect((await admin.query(`SELECT status FROM workspace_chat_attachments WHERE id=$1`,[item.id])).rows[0].status).toBe('failed');
    const retry=(await chat.uploadChatAttachment(lead,upload,image,storage)).attachment;expect(retry.id).toBe(item.id);
    await chat.discardChatAttachment(lead,retry.id,storage);
    expect((await admin.query(`SELECT status FROM workspace_chat_attachments WHERE id=$1`,[item.id])).rows[0].status).toBe('failed');
  });
  it('validates voice container bytes and keeps chat attachments inside the existing team quota',async()=>{
    const invalid={teamId,requestId:randomUUID(),kind:'voice' as const,filename:'voice.webm',mimeType:'audio/webm',durationMs:1000};
    await expect(chat.uploadChatAttachment(lead,invalid,Buffer.from('<html>not-audio</html>'),storage)).rejects.toMatchObject({code:'unsupported_audio'});
    const webm=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.from('webm A_OPUS'),Buffer.alloc(32),Buffer.from([0x1f,0x43,0xb6,0x75])]);
    const voice=(await chat.uploadChatAttachment(lead,{...invalid,requestId:randomUUID()},webm,storage)).attachment;
    expect(voice.mimeType).toBe('audio/webm');expect(voice.durationVerified).toBe(false);
    await chat.sendTeamChat(lead,{teamId,requestId:randomUUID(),attachmentId:voice.id});expect((await chat.readChatAttachment(member,voice.id,storage)).mimeType).toBe('audio/webm');
    const fake=(await admin.query<{id:string}>(`INSERT INTO workspace_chat_attachments(id,team_id,user_id,request_id,kind,mime_type,size_bytes,storage_key,sha256,payload_hash,status)
      SELECT gen_random_uuid(),$1,$2,gen_random_uuid(),'photo','image/png',CASE WHEN n=34 THEN 5242880 ELSE 15728640 END,'synthetic/never-created/'||n,'fixture','fixture','ready' FROM generate_series(1,34) n RETURNING id`,[teamId,lead.id])).rows.map(row=>row.id);
    try{await expect(chat.uploadChatAttachment(lead,{...invalid,requestId:randomUUID()},webm,storage)).rejects.toMatchObject({code:'storage_quota_exceeded'});}
    finally{await admin.query(`DELETE FROM workspace_chat_attachments WHERE id=ANY($1::uuid[])`,[fake]);}
  });
  it('does not let an expired slow upload finalize or fail a newer same-request storage reservation',async()=>{
    const image=await sharp({create:{width:16,height:16,channels:3,background:'#ddbbaa'}}).png().toBuffer();
    for(const oldOutcome of ['resolve','reject'] as const){
      const upload={teamId,requestId:randomUUID(),kind:'photo' as const,filename:'race.png',mimeType:'image/png'};
      let oldStarted!:(key:string)=>void,newStarted!:(key:string)=>void,finishOld!:()=>void,failOld!:(error:Error)=>void,finishNew!:()=>void;
      const oldHasStarted=new Promise<string>(resolve=>{oldStarted=resolve;}),newHasStarted=new Promise<string>(resolve=>{newStarted=resolve;});
      const oldGate=new Promise<void>((resolve,reject)=>{finishOld=resolve;failOld=reject;}),newGate=new Promise<void>(resolve=>{finishNew=resolve;});
      let uploads=0;
      const delayed:StorageAdapter={...storage,put:async(key,bytes)=>{uploads++;if(uploads===1){oldStarted(key);await oldGate;}else{newStarted(key);await newGate;}objects.set(key,bytes);}};
      const first=chat.uploadChatAttachment(lead,upload,image,delayed).then(value=>({ok:true as const,value}),error=>({ok:false as const,error}));
      const oldKey=await oldHasStarted;
      await admin.query(`UPDATE workspace_chat_attachments SET expires_at=now()-interval '1 second' WHERE user_id=$1 AND request_id=$2`,[lead.id,upload.requestId]);
      const second=chat.uploadChatAttachment(lead,upload,image,delayed);
      const newKey=await newHasStarted;expect(newKey).not.toBe(oldKey);
      if(oldOutcome==='resolve')finishOld();else failOld(new Error('old put failed after restaging'));
      expect((await first).ok).toBe(false);
      const pending=(await admin.query(`SELECT status,storage_key,size_bytes FROM workspace_chat_attachments WHERE user_id=$1 AND request_id=$2`,[lead.id,upload.requestId])).rows[0];
      expect(pending.status).toBe('staging');expect(pending.storage_key).toBe(newKey);expect(Number(pending.size_bytes)).toBeGreaterThan(0);expect(objects.has(newKey)).toBe(false);
      finishNew();const completed=await second;
      const ready=(await admin.query(`SELECT status,storage_key FROM workspace_chat_attachments WHERE id=$1`,[completed.attachment.id])).rows[0];
      expect(ready.status).toBe('ready');expect(ready.storage_key).toBe(newKey);expect(objects.has(newKey)).toBe(true);expect(objects.has(oldKey)).toBe(false);
      await chat.discardChatAttachment(lead,completed.attachment.id,storage);
    }
  });
  it('enforces six active participants and rejects removed team members on the next request',async()=>{
    const joined=[];for(const user of users.filter(item=>item!==outsider).slice(0,6)){const id=randomUUID();await calls.manageTeamCall(user,{command:'join',teamId,participantId:id});joined.push(id);}
    await expect(calls.manageTeamCall(users[7],{command:'join',teamId,participantId:randomUUID()})).rejects.toMatchObject({code:'call_full'});
    for(const id of joined)await admin.query(`UPDATE workspace_call_participants SET expires_at=now() WHERE id=$1`,[id]);
    await admin.query(`UPDATE team_memberships SET status='removed',left_at=now() WHERE team_id=$1 AND user_id=$2`,[teamId,member.id]);
    await expect(chat.listTeamChat(member,teamId)).rejects.toMatchObject({code:'forbidden'});
    await expect(calls.manageTeamCall(member,{command:'join',teamId,participantId:randomUUID()})).rejects.toMatchObject({code:'forbidden'});
  });
});

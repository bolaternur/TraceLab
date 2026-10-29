import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {CHAT_LIMITS,ChatError} from '@/server/workspace-chat-contract';

const auth=vi.hoisted(()=>({getCurrentUser:vi.fn()}));
const chat=vi.hoisted(()=>({listTeamChat:vi.fn(),sendTeamChat:vi.fn(),uploadChatAttachment:vi.fn(),readChatAttachment:vi.fn(),discardChatAttachment:vi.fn()}));
const calls=vi.hoisted(()=>({manageTeamCall:vi.fn(),pollTeamCall:vi.fn()}));
vi.mock('next/server',()=>({NextResponse:{json:(body:unknown,init:ResponseInit)=>Response.json(body,init)}}));
vi.mock('@/server/auth',()=>auth);
vi.mock('@/server/workspace-chat-service',()=>chat);
vi.mock('@/server/workspace-chat-calls',()=>calls);
vi.mock('@/server/workspace-service',()=>({WorkspaceError:class WorkspaceError extends Error{constructor(public code:string,public status:number){super(code);}}}));
import {chatGet,chatSend,chatUpload,chatFile,chatDiscard,callGet,callPost} from '@/server/workspace-chat-http';

const origin='http://localhost:3000';
const teamId='a1111111-1111-4111-8111-111111111111',participantId='b2222222-2222-4222-8222-222222222222',attachmentId='c3333333-3333-4333-8333-333333333333',requestId='d4444444-4444-4444-8444-444444444444';
const user={id:'e5555555-5555-4555-8555-555555555555',displayName:'HTTP fixture',locale:'ru'};
const message={teamId,requestId,text:'Fixture message'};
const join={command:'join',teamId,participantId};
const metadata={teamId,requestId,kind:'voice',filename:'fixture.webm',mimeType:'audio/webm',durationMs:2500};
function request(path:string,body:string,headers:Record<string,string>={}){return new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Iznera-Chat-Owner':user.id,...headers},body});}
function json(path:string,body:unknown,headers:Record<string,string>={}){return request(path,JSON.stringify(body),headers);}
function upload(header:string|undefined=encodeURIComponent(JSON.stringify(metadata)),body:BodyInit|null='fixture bytes',headers:Record<string,string>={}){
  return new Request(origin+'/api/workspace/chat/attachments',{method:'POST',headers:{Origin:origin,'Content-Type':'audio/webm','X-Iznera-Chat-Owner':user.id,...(header===undefined?{}:{'X-Iznera-Chat-Metadata':header}),...headers},body});
}
function discard(headers:Record<string,string>={}){return new Request(origin+'/api/workspace/chat/attachments/'+attachmentId,{method:'DELETE',headers:{Origin:origin,'X-Iznera-Chat-Owner':user.id,...headers}});}
function privateResponse(response:Response){
  expect(response.headers.get('Cache-Control')).toContain('private');expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(response.headers.get('Pragma')).toBe('no-cache');expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
}
beforeEach(()=>{
  vi.clearAllMocks();vi.stubEnv('NODE_ENV','test');vi.stubEnv('APP_URL',origin);
  auth.getCurrentUser.mockResolvedValue(user);
  chat.listTeamChat.mockResolvedValue({teamId,userId:user.id,items:[],latestSequence:'0'});
  chat.sendTeamChat.mockResolvedValue({message:{id:'fixture-message',text:message.text}});
  chat.uploadChatAttachment.mockResolvedValue({attachment:{id:attachmentId}});
  chat.discardChatAttachment.mockResolvedValue({discarded:true});
  chat.readChatAttachment.mockResolvedValue({bytes:Buffer.from('0123456789'),mimeType:'audio/webm',sizeBytes:10});
  calls.manageTeamCall.mockResolvedValue({participantId,participants:[]});calls.pollTeamCall.mockResolvedValue({participants:[],signals:[],cursor:'0'});
});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

describe('private team chat HTTP boundary',()=>{
  it('requires an authenticated account before reading messages, files, call state or invoking mutations',async()=>{
    auth.getCurrentUser.mockResolvedValue(null);
    const responses=[
      await chatGet(new Request(origin+'/api/workspace/chat?team='+teamId)),
      await chatSend(json('/api/workspace/chat',message)),
      await chatUpload(upload()),
      await chatFile(new Request(origin+'/api/workspace/chat/attachments/'+attachmentId),attachmentId),
      await chatDiscard(discard(),attachmentId),
      await callGet(new Request(origin+`/api/workspace/chat/call?team=${teamId}&participant=${participantId}`)),
      await callPost(json('/api/workspace/chat/call',join)),
    ];
    for(const response of responses){expect(response.status).toBe(401);expect(await response.json()).toEqual({error:{code:'unauthenticated'}});privateResponse(response);}
    for(const fn of [...Object.values(chat),...Object.values(calls)])expect(fn).not.toHaveBeenCalled();
  });
  it('rejects missing/foreign origins and cross-site writes before consulting services or reading upload bytes',async()=>{
    const invalidHeaders:Record<string,string>[]=[{Origin:''},{Origin:'https://foreign.example'},{Origin:origin,'Sec-Fetch-Site':'cross-site'}];
    for(const headers of invalidHeaders){
      const responses=[await chatSend(json('/api/workspace/chat',message,headers)),await callPost(json('/api/workspace/chat/call',join,headers)),await chatUpload(upload(undefined,'fixture',headers)),await chatDiscard(discard(headers),attachmentId)];
      for(const response of responses){expect(response.status).toBe(403);expect(await response.json()).toEqual({error:{code:'origin_rejected'}});privateResponse(response);}
    }
    expect(auth.getCurrentUser).not.toHaveBeenCalled();for(const fn of [...Object.values(chat),...Object.values(calls)])expect(fn).not.toHaveBeenCalled();
  });
  it('blocks a missing or previous-account draft owner before messages, uploads, discard or call writes',async()=>{
    for(const owner of ['',participantId]){
      const headers={'X-Iznera-Chat-Owner':owner};
      const responses=[await chatSend(json('/api/workspace/chat',message,headers)),await callPost(json('/api/workspace/chat/call',join,headers)),await chatUpload(upload(undefined,'fixture',headers)),await chatDiscard(discard(headers),attachmentId)];
      for(const response of responses){expect(response.status).toBe(403);expect(await response.json()).toEqual({error:{code:'account_changed'}});privateResponse(response);}
    }
    for(const fn of [...Object.values(chat),...Object.values(calls)])expect(fn).not.toHaveBeenCalled();
  });
  it('derives the actor from the account session and preserves pagination/call parameters',async()=>{
    const response=await chatGet(new Request(origin+`/api/workspace/chat?team=${teamId}&after=51`));
    expect(response.status).toBe(200);privateResponse(response);expect(chat.listTeamChat).toHaveBeenCalledWith(user,teamId,{before:null,after:'51'});
    const sent=await chatSend(json('/api/workspace/chat',message));expect(sent.status).toBe(200);privateResponse(sent);expect(chat.sendTeamChat).toHaveBeenCalledWith(user,message);
    const poll=await callGet(new Request(origin+`/api/workspace/chat/call?team=${teamId}&participant=${participantId}&after=17`));expect(poll.status).toBe(200);privateResponse(poll);expect(calls.pollTeamCall).toHaveBeenCalledWith(user,teamId,participantId,'17');
    const joined=await callPost(json('/api/workspace/chat/call',join));expect(joined.status).toBe(200);privateResponse(joined);expect(calls.manageTeamCall).toHaveBeenCalledWith(user,join);
  });
  it('bounds actual JSON bytes and rejects malformed or non-JSON mutations without invoking their services',async()=>{
    for(const [path,handler,size] of [['/api/workspace/chat',chatSend,20000],['/api/workspace/chat/call',callPost,65536]] as const){
      for(const [body,headers,status] of [
        ['{',{},400],
        ['{}',{'Content-Type':'text/plain'},415],
        [JSON.stringify({value:'x'.repeat(size+1)}),{'Content-Length':'1'},413],
      ] as const){const response=await handler(request(path,body,headers));expect(response.status).toBe(status);privateResponse(response);}
    }
    expect(chat.sendTeamChat).not.toHaveBeenCalled();expect(calls.manageTeamCall).not.toHaveBeenCalled();
  });
  it('rejects absent, malformed, excessive and caller-expanded upload metadata before saving any bytes',async()=>{
    const requests=[
      new Request(origin+'/api/workspace/chat/attachments',{method:'POST',headers:{Origin:origin,'X-Iznera-Chat-Owner':user.id},body:'fixture'}),
      upload('%bad'),upload(encodeURIComponent('{')),upload('x'.repeat(5001)),
      upload(encodeURIComponent(JSON.stringify({...metadata,kind:'video'}))),
      upload(encodeURIComponent(JSON.stringify({...metadata,durationMs:CHAT_LIMITS.voiceDurationMs+1}))),
      upload(encodeURIComponent(JSON.stringify({...metadata,authorId:user.id}))),
    ];
    for(const input of requests){const response=await chatUpload(input);expect(response.status).toBe(422);privateResponse(response);}
    expect(chat.uploadChatAttachment).not.toHaveBeenCalled();
  });
  it('enforces both declared and streamed attachment limits and refuses empty/incomplete bodies',async()=>{
    const requests=[
      {request:upload(undefined,'x',{'Content-Length':String(CHAT_LIMITS.voiceBytes+1)}),status:413},
      {request:upload(undefined,new Uint8Array(CHAT_LIMITS.voiceBytes+1),{'Content-Length':'1'}),status:413},
      {request:upload(undefined,null),status:422},
      {request:upload(undefined,'abc',{'Content-Length':'4'}),status:422},
    ];
    for(const input of requests){const response=await chatUpload(input.request);expect(response.status).toBe(input.status);privateResponse(response);}
    expect(chat.uploadChatAttachment).not.toHaveBeenCalled();
  });
  it('forwards bounded upload bytes and metadata with the authenticated identity and private response headers',async()=>{
    const response=await chatUpload(upload());expect(response.status).toBe(201);privateResponse(response);
    expect(chat.uploadChatAttachment).toHaveBeenCalledWith(user,metadata,Buffer.from('fixture bytes'));
    expect(await response.json()).toEqual({attachment:{id:attachmentId}});
  });
  it('returns only authorized private audio bytes and serves inclusive/open-ended ranges',async()=>{
    const full=await chatFile(new Request(origin+'/api/workspace/chat/attachments/'+attachmentId),attachmentId);
    expect(full.status).toBe(200);privateResponse(full);expect(full.headers.get('Content-Type')).toBe('audio/webm');expect(full.headers.get('Content-Length')).toBe('10');expect(await full.text()).toBe('0123456789');
    for(const [range,text,contentRange] of [['bytes=2-5','2345','bytes 2-5/10'],['bytes=7-','789','bytes 7-9/10'],['bytes=8-99','89','bytes 8-9/10']]){
      const response=await chatFile(new Request(origin+'/api/workspace/chat/attachments/'+attachmentId,{headers:{Range:range}}),attachmentId);
      expect(response.status).toBe(206);privateResponse(response);expect(response.headers.get('Accept-Ranges')).toBe('bytes');expect(response.headers.get('Content-Range')).toBe(contentRange);expect(response.headers.get('Content-Length')).toBe(String(text.length));expect(await response.text()).toBe(text);
    }
    expect(chat.readChatAttachment).toHaveBeenCalledWith(user,attachmentId);
  });
  it('returns private 416 responses for malformed, multiple, reversed and out-of-range byte requests',async()=>{
    for(const range of ['invalid','bytes=0-1,3-4','bytes=9-2','bytes=10-','bytes=9999999999999999999999-']){
      const response=await chatFile(new Request(origin+'/api/workspace/chat/attachments/'+attachmentId,{headers:{Range:range}}),attachmentId);
      expect(response.status).toBe(416);privateResponse(response);expect(response.headers.get('Content-Range')).toBe('bytes */10');expect((await response.arrayBuffer()).byteLength).toBe(0);
    }
  });
  it('retains privacy headers on denied files and never serializes unexpected internal service details',async()=>{
    chat.readChatAttachment.mockRejectedValue(new ChatError('not_found',404));
    const denied=await chatFile(new Request(origin+'/api/workspace/chat/attachments/'+attachmentId),attachmentId);expect(denied.status).toBe(404);privateResponse(denied);expect(await denied.json()).toEqual({error:{code:'not_found'}});
    vi.spyOn(console,'error').mockImplementation(()=>{});
    chat.listTeamChat.mockRejectedValue(new Error('private database host and password'));
    const failed=await chatGet(new Request(origin+'/api/workspace/chat?team='+teamId));expect(failed.status).toBe(503);privateResponse(failed);expect(await failed.json()).toEqual({error:{code:'service_unavailable'}});
  });
});

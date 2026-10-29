import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({user:vi.fn(),list:vi.fn(),send:vi.fn(),upload:vi.fn(),read:vi.fn(),discard:vi.fn(),call:vi.fn(),poll:vi.fn()}));
vi.mock('@/server/auth',()=>({getCurrentUser:state.user}));
vi.mock('@/server/workspace-service',()=>({WorkspaceError:class extends Error{constructor(public code:string,public status:number){super(code);}}}));
vi.mock('@/server/workspace-chat-service',()=>({listTeamChat:state.list,sendTeamChat:state.send,uploadChatAttachment:state.upload,readChatAttachment:state.read,discardChatAttachment:state.discard}));
vi.mock('@/server/workspace-chat-calls',()=>({manageTeamCall:state.call,pollTeamCall:state.poll}));
import {chatGet,chatSend,chatFile,chatDiscard,callPost} from '@/server/workspace-chat-http';
const base='http://localhost:3000',user={id:'fixture-user',displayName:'Fixture',locale:'ru'};
function post(path='/api/workspace/chat',origin=base){return new Request(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Iznera-Chat-Owner':user.id},body:'{}'});}
beforeEach(()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('APP_URL',base);for(const fn of Object.values(state))fn.mockReset();state.user.mockResolvedValue(user);state.list.mockResolvedValue({items:[]});state.send.mockResolvedValue({message:{id:'fixture'}});});
afterEach(()=>vi.unstubAllEnvs());
describe('private conversation HTTP boundary',()=>{
  it('requires authentication for history, posting and private attachments',async()=>{
    state.user.mockResolvedValue(null);
    expect((await chatGet(new Request(base+'/api/workspace/chat?team=fixture'))).status).toBe(401);
    expect((await chatSend(post())).status).toBe(401);
    expect((await chatFile(new Request(base+'/api/workspace/chat/attachments/fixture'),'fixture')).status).toBe(401);
    expect(state.list).not.toHaveBeenCalled();expect(state.send).not.toHaveBeenCalled();expect(state.read).not.toHaveBeenCalled();
  });
  it('rejects cross-origin changes before entering message/call/storage services',async()=>{
    for(const origin of ['', 'https://foreign.example']){
      expect((await chatSend(post(undefined,origin))).status).toBe(403);
      expect((await callPost(post('/api/workspace/chat/call',origin))).status).toBe(403);
      expect((await chatDiscard(post('/api/workspace/chat/attachments/fixture',origin),'fixture')).status).toBe(403);
    }
    expect(state.send).not.toHaveBeenCalled();expect(state.call).not.toHaveBeenCalled();expect(state.discard).not.toHaveBeenCalled();
  });
  it('keeps authenticated responses private and never exposes database errors',async()=>{
    const response=await chatGet(new Request(base+'/api/workspace/chat?team=fixture&after=20'));expect(response.headers.get('cache-control')).toContain('no-store');expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(state.list).toHaveBeenCalledWith(user,'fixture',{before:null,after:'20'});
    state.list.mockRejectedValue(new Error('private database password and SQL'));
    const failed=await chatGet(new Request(base+'/api/workspace/chat?team=fixture'));expect(failed.status).toBe(503);expect(await failed.text()).not.toContain('password');
  });
  it('supports bounded private audio ranges and rejects malformed ranges',async()=>{
    state.read.mockResolvedValue({bytes:Buffer.from('0123456789'),mimeType:'audio/webm',sizeBytes:10});
    const partial=await chatFile(new Request(base+'/api/workspace/chat/attachments/fixture',{headers:{Range:'bytes=2-5'}}),'fixture');expect(partial.status).toBe(206);expect(partial.headers.get('content-range')).toBe('bytes 2-5/10');expect(await partial.text()).toBe('2345');
    for(const range of ['bytes=99-100','bytes=2-1','bytes=0-1,4-5','invalid'])expect((await chatFile(new Request(base+'/api/workspace/chat/attachments/fixture',{headers:{Range:range}}),'fixture')).status).toBe(416);
  });
});

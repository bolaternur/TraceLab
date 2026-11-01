import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {chatPost,chatAttachment,voiceType,CHAT_LIMITS,sequence,chatIceServers} from '@/server/workspace-chat-contract';
describe('team chat boundaries',()=>{
  it('requires content, stable request identity and bounded typed attachments',()=>{
    const base={teamId:randomUUID(),requestId:randomUUID()};
    expect(chatPost.parse({...base,text:'  Hello  '})).toMatchObject({text:'Hello'});
    expect(()=>chatPost.parse(base)).toThrow();expect(()=>chatPost.parse({...base,text:'x'.repeat(4001)})).toThrow();
    expect(()=>chatPost.parse({...base,text:'Hi',authorId:randomUUID()})).toThrow();
    expect(()=>chatAttachment.parse({...base,kind:'voice',filename:'note.webm',mimeType:'audio/webm',durationMs:300001})).toThrow();
    expect(sequence('0')).toBe('0');for(const value of ['1e6','-1','x','9'.repeat(19)])expect(()=>sequence(value)).toThrow();
  });
  it('checks actual audio container and codec signatures rather than a file extension',()=>{
    for(const bytes of [Buffer.from('<html>voice.webm</html>'),Buffer.from('OggS fake OpusHead'),Buffer.from('ordinary mp4 text')])expect(()=>voiceType(bytes)).toThrow();
    const webm=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.from('webm A_OPUS'),Buffer.alloc(32),Buffer.from([0x1f,0x43,0xb6,0x75])]);
    expect(voiceType(webm)).toBe('audio/webm');expect(()=>voiceType(Buffer.concat([webm,Buffer.from('V_VP9')]))).toThrow();
    expect(()=>voiceType(Buffer.alloc(CHAT_LIMITS.voiceBytes+1))).toThrow();
  });
  it('does not contact external ICE services by default and returns only short-lived TURN credentials',()=>{
    expect(chatIceServers(randomUUID(),{NODE_ENV:'test'})).toEqual([]);
    const secret='synthetic-shared-secret',user=randomUUID();
    const servers=chatIceServers(user,{NODE_ENV:'test',CHAT_STUN_URLS:'stun:stun.example.invalid:3478,https://invalid',CHAT_TURN_URLS:'turns:relay.example.invalid:5349?transport=tcp',CHAT_TURN_SHARED_SECRET:secret},1000000);
    expect(servers).toHaveLength(2);expect(servers[1].username).toBe(`4600:${user}`);expect(servers[1].credential).toBeTruthy();expect(JSON.stringify(servers)).not.toContain(secret);
    expect(chatIceServers(user,{NODE_ENV:'test',CHAT_TURN_URLS:'turn:relay.example.invalid'})).toEqual([]);
  });
});

import {createHash,createHmac} from 'node:crypto';
import {z} from 'zod';
export const CHAT_LIMITS=Object.freeze({textLength:4000,pageSize:50,photoBytes:15*1024*1024,voiceBytes:6*1024*1024,voiceDurationMs:300000,teamBytes:500*1024*1024,participants:6,leaseSeconds:45});
export class ChatError extends Error{constructor(public code:string,public status=422){super(code);this.name='ChatError';}}
const uuid=z.string().uuid();
const text=z.string().trim().max(CHAT_LIMITS.textLength).refine(value=>!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value));
export const chatPost=z.object({teamId:uuid,requestId:uuid,text:text.default(''),attachmentId:uuid.optional()}).strict().refine(value=>Boolean(value.text||value.attachmentId));
export const chatAttachment=z.object({teamId:uuid,requestId:uuid,kind:z.enum(['photo','voice']),filename:z.string().min(1).max(180),mimeType:z.string().min(1).max(100),durationMs:z.number().int().positive().max(CHAT_LIMITS.voiceDurationMs).optional()}).strict();
export type ChatAttachmentInput=z.infer<typeof chatAttachment>;
export const callCommand=z.discriminatedUnion('command',[
  z.object({command:z.enum(['join','heartbeat','leave']),teamId:uuid,participantId:uuid}).strict(),
  z.object({command:z.literal('signal'),teamId:uuid,participantId:uuid,toParticipantId:uuid,type:z.enum(['offer','answer','ice']),payload:z.record(z.string(),z.unknown())}).strict(),
]);
export function chatHash(value:Buffer|string){return createHash('sha256').update(value).digest('hex');}
export function sequence(value:string|null|undefined){if(!value)return null;if(!/^\d{1,18}$/.test(value))throw new ChatError('invalid_cursor');return value;}
/** Container/codec signature validation; duration is client-reported, never claimed as server-decoded. */
export function voiceType(bytes:Buffer){
  if(!bytes.length||bytes.length>CHAT_LIMITS.voiceBytes)throw new ChatError('file_too_large',413);
  const head=bytes.subarray(0,Math.min(bytes.length,65536));
  if(bytes.length>32&&bytes.readUInt32BE(0)===0x1a45dfa3&&head.includes(Buffer.from('webm'))&&(head.includes(Buffer.from('A_OPUS'))||head.includes(Buffer.from('A_VORBIS')))&&!head.includes(Buffer.from('V_VP'))&&bytes.includes(Buffer.from([0x1f,0x43,0xb6,0x75])))return 'audio/webm';
  if(bytes.length>32&&bytes.toString('ascii',0,4)==='OggS'&&bytes[4]===0&&head.includes(Buffer.from('OpusHead'))){
    let offset=0,pages=0;while(offset<bytes.length){if(++pages>20000||offset+27>bytes.length||bytes.toString('ascii',offset,offset+4)!=='OggS'||bytes[offset+4]!==0)throw new ChatError('unsupported_audio');const segments=bytes[offset+26];if(offset+27+segments>bytes.length)throw new ChatError('unsupported_audio');let size=0;for(let i=0;i<segments;i++)size+=bytes[offset+27+i];offset+=27+segments+size;if(offset>bytes.length)throw new ChatError('unsupported_audio');}return 'audio/ogg';
  }
  if(bytes.length>32&&bytes.toString('ascii',4,8)==='ftyp'&&bytes.includes(Buffer.from('moov'))&&bytes.includes(Buffer.from('mdat'))&&bytes.includes(Buffer.from('soun'))&&!bytes.includes(Buffer.from('vide')))return 'audio/mp4';
  throw new ChatError('unsupported_audio');
}
export function chatIceServers(userId:string,env:NodeJS.ProcessEnv=process.env,now=Date.now()){
  const clean=(raw:string|undefined,prefix:RegExp)=>(raw||'').split(',').map(value=>value.trim()).filter(value=>value.length<=500&&prefix.test(value)&&!/[\s<>"'@]/.test(value)).slice(0,4);
  const servers:Array<{urls:string[];username?:string;credential?:string}>=[];
  const stun=clean(env.CHAT_STUN_URLS,/^stuns?:[A-Za-z0-9.[\]:-]+$/);if(stun.length)servers.push({urls:stun});
  const turn=clean(env.CHAT_TURN_URLS,/^turns?:[A-Za-z0-9.[\]:-]+(?:\?transport=(?:udp|tcp))?$/);
  if(turn.length&&env.CHAT_TURN_SHARED_SECRET){const username=`${Math.floor(now/1000)+3600}:${userId}`;servers.push({urls:turn,username,credential:createHmac('sha1',env.CHAT_TURN_SHARED_SECRET).update(username).digest('base64')});}
  return servers;
}

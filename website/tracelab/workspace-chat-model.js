export const CHAT_LIMITS=Object.freeze({text:4000,photoBytes:15*1024*1024,voiceBytes:6*1024*1024,voiceMs:300000});
export function chatAttachmentError(file,kind,durationMs=0){
  if(!file||!Number.isFinite(file.size)||file.size<=0)return kind==='photo'?'photoFormat':'voiceFormat';
  const mime=String(file.type||'').split(';')[0].trim().toLowerCase();
  if(kind==='photo')return /^image\/(jpeg|png|webp)$/.test(mime)&&file.size<=CHAT_LIMITS.photoBytes?null:'photoFormat';
  return /^audio\/(webm|ogg|mp4)$/.test(mime)&&file.size<=CHAT_LIMITS.voiceBytes&&Number.isFinite(durationMs)&&durationMs>0&&durationMs<=CHAT_LIMITS.voiceMs?null:'voiceFormat';
}
export function mergeChatMessages(existing,incoming){const rows=new Map(existing.map(item=>[item.id,item]));for(const item of incoming)if(item&&typeof item.id==='string'&&/^\d+$/.test(String(item.sequence)))rows.set(item.id,item);return [...rows.values()].sort((a,b)=>{const left=BigInt(a.sequence),right=BigInt(b.sequence);return left<right?-1:left>right?1:String(a.id).localeCompare(String(b.id));});}
export function privateChatAttachmentUrl(value,origin){try{const url=new URL(value,origin);return url.origin===origin&&/^\/api\/workspace\/chat\/attachments\/[a-f0-9-]{36}$/.test(url.pathname)&&!url.search&&!url.hash?url.pathname:null;}catch{return null;}}
export function preferredAudioMime(recorder){return ['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(mime=>recorder.isTypeSupported(mime))||'';}

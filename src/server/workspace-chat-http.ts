import {NextResponse} from 'next/server';
import {ZodError} from 'zod';
import {getCurrentUser} from './auth';
import {accountOrigin,AccountError,readAccountJson} from './account-contract';
import {CHAT_LIMITS,ChatError,chatAttachment} from './workspace-chat-contract';
import {WorkspaceError} from './workspace-service';
import {MediaError,readUploadBytes} from './workspace-media-contract';
import {listTeamChat,sendTeamChat,uploadChatAttachment,readChatAttachment,discardChatAttachment} from './workspace-chat-service';
import {manageTeamCall,pollTeamCall} from './workspace-chat-calls';
export const chatHeaders={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
export function chatJson(data:unknown,status=200){return NextResponse.json(data,{status,headers:chatHeaders});}
export function chatFailure(error:unknown){
  if(error instanceof ChatError||error instanceof AccountError||error instanceof WorkspaceError||error instanceof MediaError)return chatJson({error:{code:error.code}},error.status);
  if(error instanceof ZodError)return chatJson({error:{code:'invalid_fields'}},422);
  const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';
  if(code==='42501')return chatJson({error:{code:'forbidden'}},403);
  if(code==='23505')return chatJson({error:{code:'request_conflict'}},409);
  console.error(JSON.stringify({level:'error',event:'team_chat_failed',code}));
  return chatJson({error:{code:'service_unavailable'}},503);
}
async function user(){const value=await getCurrentUser();if(!value)throw new ChatError('unauthenticated',401);return value;}
async function writer(request:Request){const value=await user();if(request.headers.get('x-iznera-chat-owner')!==value.id)throw new ChatError('account_changed',403);return value;}
export async function chatGet(request:Request){try{const who=await user(),p=new URL(request.url).searchParams;return chatJson(await listTeamChat(who,p.get('team')||'',{before:p.get('before'),after:p.get('after')}));}catch(error){return chatFailure(error);}}
export async function chatSend(request:Request){try{accountOrigin(request.url,request.headers);return chatJson(await sendTeamChat(await writer(request),await readAccountJson(request,20000)));}catch(error){return chatFailure(error);}}
export async function chatUpload(request:Request){try{
  accountOrigin(request.url,request.headers);const who=await writer(request),header=request.headers.get('x-iznera-chat-metadata');
  if(!header||header.length>5000)throw new ChatError('invalid_metadata');
  let metadata:unknown;try{metadata=JSON.parse(decodeURIComponent(header));}catch{throw new ChatError('invalid_metadata');}
  const input=chatAttachment.parse(metadata),bytes=await readUploadBytes(request,input.kind==='voice'?CHAT_LIMITS.voiceBytes:CHAT_LIMITS.photoBytes);
  return chatJson(await uploadChatAttachment(who,input,bytes),201);
}catch(error){return chatFailure(error);}}
export async function chatFile(request:Request,id:string){try{
  const file=await readChatAttachment(await user(),id),range=request.headers.get('range');
  const headers:Record<string,string>={...chatHeaders,'Content-Type':file.mimeType,'Accept-Ranges':'bytes','Content-Disposition':'inline'};
  if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${file.bytes.length}`}});
    const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),file.bytes.length-1):file.bytes.length-1;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=file.bytes.length)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${file.bytes.length}`}});
    return new Response(new Uint8Array(file.bytes.subarray(start,end+1)),{status:206,headers:{...headers,'Content-Length':String(end-start+1),'Content-Range':`bytes ${start}-${end}/${file.bytes.length}`}});
  }
  return new Response(new Uint8Array(file.bytes),{headers:{...headers,'Content-Length':String(file.bytes.length)}});
}catch(error){return chatFailure(error);}}
export async function callGet(request:Request){try{const p=new URL(request.url).searchParams;return chatJson(await pollTeamCall(await user(),p.get('team')||'',p.get('participant')||'',p.get('after')));}catch(error){return chatFailure(error);}}
export async function chatDiscard(request:Request,id:string){try{accountOrigin(request.url,request.headers);return chatJson(await discardChatAttachment(await writer(request),id));}catch(error){return chatFailure(error);}}
export async function callPost(request:Request){try{accountOrigin(request.url,request.headers);return chatJson(await manageTeamCall(await writer(request),await readAccountJson(request,65536)));}catch(error){return chatFailure(error);}}

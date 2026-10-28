import { getCurrentUser } from "@/server/auth";
import { accountOrigin } from "@/server/account-contract";
import { parseUploadMetadata, readUploadBytes, uploadLimit } from "@/server/workspace-media-contract";
import { authorizeMediaUpload, listWorkspaceMedia, uploadWorkspaceMedia } from "@/server/workspace-media-service";
import { mediaFailure, mediaJson } from "@/server/workspace-media-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{
    const user=await getCurrentUser();if(!user)return mediaJson({error:{code:"unauthenticated"}},401);
    const params=new URL(request.url).searchParams;
    return mediaJson(await listWorkspaceMedia(user,{teamId:params.get("team")||"",projectId:params.get("project")||"",
      mode:params.get("mode")||undefined,offset:Number(params.get("offset")||0)}));
  }catch(error){return mediaFailure(error);}
}
export async function POST(request:Request){
  try{
    accountOrigin(request.url,request.headers);
    const user=await getCurrentUser();if(!user)return mediaJson({error:{code:"unauthenticated"}},401);
    const queuedOwner=request.headers.get("x-tracelab-queue-owner");
    if(queuedOwner&&queuedOwner!==user.id)return mediaJson({error:{code:"queue_owner_mismatch"}},403);
    const input=parseUploadMetadata(request.headers.get("x-tracelab-metadata"));
    await authorizeMediaUpload(user,input);
    const bytes=await readUploadBytes(request,uploadLimit(input.kind));
    return mediaJson(await uploadWorkspaceMedia(user,input,bytes),201);
  }catch(error){return mediaFailure(error);}
}

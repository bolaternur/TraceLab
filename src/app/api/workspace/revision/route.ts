import {getCurrentUser} from "@/server/auth";
import {getWorkspaceRevision} from "@/server/workspace-revision-service";
import {mediaFailure,mediaJson} from "@/server/workspace-media-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{
    const user=await getCurrentUser();
    if(!user)return mediaJson({error:{code:"unauthenticated"}},401);
    return mediaJson(await getWorkspaceRevision(user,new URL(request.url).searchParams.get("team")||""));
  }catch(error){return mediaFailure(error);}
}

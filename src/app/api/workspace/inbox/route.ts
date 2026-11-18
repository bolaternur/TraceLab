import {getCurrentUser} from "@/server/auth";
import {accountOrigin,readAccountJson} from "@/server/account-contract";
import {getWorkspaceInbox,manageWorkspaceInbox} from "@/server/workspace-inbox-service";
import {sourcesFailure,sourcesJson} from "@/server/workspace-sources-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{const user=await getCurrentUser();if(!user)return sourcesJson({error:{code:"unauthenticated"}},401);const params=new URL(request.url).searchParams;
  return sourcesJson(await getWorkspaceInbox(user,params.get("project")||"",{status:params.get("status"),cursor:params.get("cursor")}));}catch(error){return sourcesFailure(error);}}
export async function POST(request:Request){try{accountOrigin(request.url,request.headers);const user=await getCurrentUser();if(!user)return sourcesJson({error:{code:"unauthenticated"}},401);
  return sourcesJson(await manageWorkspaceInbox(user,await readAccountJson(request,32768)));}catch(error){return sourcesFailure(error);}}

import {getCurrentUser} from "@/server/auth";
import {getWorkspaceHandoff,startWorkspaceSeason} from "@/server/workspace-handoff-service";
import {accountOrigin,readAccountJson} from "@/server/account-contract";
import {sourcesFailure,sourcesJson} from "@/server/workspace-sources-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  try {
    const user=await getCurrentUser();
    if(!user)return sourcesJson({error:{code:"unauthenticated"}},401);
    return sourcesJson(await getWorkspaceHandoff(user,new URL(request.url).searchParams.get("project")||""));
  }catch(error){return sourcesFailure(error);}
}
export async function POST(request:Request) {
  try {
    accountOrigin(request.url,request.headers);const user=await getCurrentUser();
    if(!user)return sourcesJson({error:{code:"unauthenticated"}},401);
    return sourcesJson(await startWorkspaceSeason(user,await readAccountJson(request,16384)));
  }catch(error){return sourcesFailure(error);}
}

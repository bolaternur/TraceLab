import {getCurrentUser} from "@/server/auth";
import {accountOrigin,readAccountJson} from "@/server/account-contract";
import {getWorkspaceTeam,manageWorkspaceTeam,TeamError} from "@/server/workspace-team-service";
import {sourcesFailure,sourcesJson} from "@/server/workspace-sources-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function failure(error:unknown){return error instanceof TeamError?sourcesJson({error:{code:error.code}},error.status):sourcesFailure(error);}
export async function GET(request:Request){try{const user=await getCurrentUser();if(!user)return sourcesJson({error:{code:"unauthenticated"}},401);return sourcesJson(await getWorkspaceTeam(user,new URL(request.url).searchParams.get("team")||""));}catch(error){return failure(error);}}
export async function POST(request:Request){try{accountOrigin(request.url,request.headers);const user=await getCurrentUser();if(!user)return sourcesJson({error:{code:"unauthenticated"}},401);return sourcesJson(await manageWorkspaceTeam(user,await readAccountJson(request,8192)));}catch(error){return failure(error);}}

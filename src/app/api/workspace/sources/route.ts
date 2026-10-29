import { getCurrentUser } from "@/server/auth";
import { accountOrigin, readAccountJson } from "@/server/account-contract";
import { listWorkspaceSources, manageWorkspaceSources } from "@/server/workspace-sources-service";
import { sourcesFailure, sourcesJson } from "@/server/workspace-sources-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
  try{const user=await getCurrentUser();if(!user)return sourcesJson({error:{code:"unauthenticated"}},401);
    return sourcesJson(await listWorkspaceSources(user,new URL(request.url).searchParams.get("project")||""));
  }catch(error){return sourcesFailure(error);}
}
export async function POST(request:Request){
  try{accountOrigin(request.url,request.headers);const user=await getCurrentUser();if(!user)return sourcesJson({error:{code:"unauthenticated"}},401);
    return sourcesJson(await manageWorkspaceSources(user,await readAccountJson(request,8192)));
  }catch(error){return sourcesFailure(error);}
}

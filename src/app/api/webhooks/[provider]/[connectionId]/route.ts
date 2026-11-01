import { POST as receiveGithub } from "@/app/api/workspace/sources/github/[connectionId]/route";
import { sourcesJson } from "@/server/workspace-sources-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Compatibility URL delegates to the same atomic, signed GitHub pipeline. */
export async function POST(request:Request,{params}:{params:Promise<{provider:string;connectionId:string}>}){
  const {provider,connectionId}=await params;
  if(provider==="github")return receiveGithub(request,{params:Promise.resolve({connectionId})});
  if(["onshape","telegram","discord"].includes(provider))return sourcesJson({error:{code:"integration_not_configured"}},501);
  return sourcesJson({error:{code:"unknown_provider"}},404);
}

import { readGithubBody } from "@/server/workspace-sources-contract";
import { receiveGithubDelivery } from "@/server/workspace-sources-service";
import { sourcesFailure, sourcesJson } from "@/server/workspace-sources-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request,{params}:{params:Promise<{connectionId:string}>}){
  try{const {connectionId}=await params;
    return sourcesJson(await receiveGithubDelivery(connectionId,request.headers.get("x-github-delivery")||"",request.headers.get("x-github-event"),
      request.headers.get("x-hub-signature-256"),await readGithubBody(request)));
  }catch(error){return sourcesFailure(error);}
}

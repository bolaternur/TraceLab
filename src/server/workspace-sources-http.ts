import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SourceError } from "./workspace-sources-contract";
import { WorkspaceError } from "./workspace-service";
import { AccountError } from "./account-contract";
const headers={"Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
export function sourcesJson(value:unknown,status=200){return NextResponse.json(value,{status,headers});}
export function sourcesFailure(error:unknown){
  if(error instanceof SourceError || error instanceof WorkspaceError || error instanceof AccountError)return sourcesJson({error:{code:error.code}},error.status);
  if(error instanceof ZodError)return sourcesJson({error:{code:"invalid_fields"}},422);
  console.error(JSON.stringify({level:"error",event:"sources_request_failed"}));
  return sourcesJson({error:{code:"sources_unavailable"}},503);
}

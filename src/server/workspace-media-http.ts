import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccountError } from "./account-contract";
import { MediaError } from "./workspace-media-contract";
import { WorkspaceError } from "./workspace-service";
export const mediaHeaders={"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"};
export function mediaJson(data:unknown,status=200){return NextResponse.json(data,{status,headers:mediaHeaders});}
export function mediaFailure(error:unknown){
  if(error instanceof MediaError || error instanceof WorkspaceError || error instanceof AccountError)
    return mediaJson({error:{code:error.code}},error.status);
  if(error instanceof ZodError)return mediaJson({error:{code:"invalid_metadata"}},422);
  const code=error && typeof error==="object" && "code" in error?String(error.code):"internal";
  if(code==="42501")return mediaJson({error:{code:"forbidden"}},403);
  console.error(JSON.stringify({level:"error",event:"workspace_media_failed",code}));
  return mediaJson({error:{code:"media_unavailable"}},503);
}

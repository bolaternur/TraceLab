import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/server/auth";
import { AccountError, accountOrigin, readAccountJson } from "@/server/account-contract";
import { WorkspaceError } from "@/server/workspace-service";
import { cancelWorkspaceReport, createWorkspaceReport, downloadWorkspaceReport, previewWorkspaceReport } from "@/server/workspace-report-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=120;
const headers={"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers});
function errorResponse(error:unknown){
  if(error instanceof WorkspaceError)return json({error:{code:error.code,message:error.message}},error.status);
  if(error instanceof AccountError)return json({error:{code:error.code,message:"Запрос отклонён."}},error.status);
  if(error instanceof ZodError)return json({error:{code:"invalid_fields",message:"Проверьте параметры отчёта."}},422);
  console.error(JSON.stringify({level:"error",event:"workspace_report_failed"}));
  return json({error:{code:"service_unavailable",message:"Не удалось подготовить отчёт. Повторите позже."}},503);
}
export async function GET(request:Request){
  try{
    const user=await getCurrentUser();if(!user)return json({error:{code:"unauthenticated",message:"Войдите в аккаунт."}},401);
    const params=new URL(request.url).searchParams;
    if(params.has("download")){
      const file=await downloadWorkspaceReport(user,params.get("download")!);
      return new Response(new Uint8Array(file.bytes),{headers:{...headers,"Content-Type":file.mimeType,"Content-Length":String(file.bytes.length),
        "Content-Disposition":`attachment; filename="${file.filename}"`,"Content-Security-Policy":"default-src 'none'; sandbox"}});
    }
    return json(await previewWorkspaceReport(user,params.get("project")??""));
  }catch(error){return errorResponse(error);}
}
export async function POST(request:Request){
  try{
    accountOrigin(request.url,request.headers);
    const user=await getCurrentUser();if(!user)return json({error:{code:"unauthenticated",message:"Войдите в аккаунт."}},401);
    return json(await createWorkspaceReport(user,await readAccountJson(request,70_000)));
  }catch(error){return errorResponse(error);}
}
export async function DELETE(request:Request){
  try{
    accountOrigin(request.url,request.headers);
    const user=await getCurrentUser();if(!user)return json({error:{code:"unauthenticated",message:"Войдите в аккаунт."}},401);
    return json(await cancelWorkspaceReport(user,new URL(request.url).searchParams.get("id")??""));
  }catch(error){return errorResponse(error);}
}

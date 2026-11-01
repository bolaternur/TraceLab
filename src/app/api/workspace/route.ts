import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/server/auth";
import { AccountError, accountOrigin, readAccountJson } from "@/server/account-contract";
import { executeWorkspaceCommand, getWorkspace, WorkspaceError } from "@/server/workspace-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control":"private, no-store, max-age=0", "Referrer-Policy":"no-referrer", "X-Content-Type-Options":"nosniff" };
function response(data: unknown, status=200) { return NextResponse.json(data,{status,headers}); }
function errorResponse(error: unknown) {
  if(error instanceof WorkspaceError) return response({error:{code:error.code,message:error.message,...(error.details?{details:error.details}:{})}},error.status);
  if(error instanceof AccountError) return response({error:{code:error.code,message:"Запрос отклонён. Проверьте адрес сайта и размер данных."}},error.status);
  if(error instanceof ZodError) return response({error:{code:"invalid_fields",message:"Проверьте обязательные поля и формат данных."}},422);
  const code = error && typeof error==="object" && "code" in error ? String(error.code) : "";
  if(code==="42501") return response({error:{code:"forbidden",message:"Нет доступа к этому действию или приглашение недоступно."}},403);
  if(["23505","23514","22023"].includes(code)) return response({error:{code:"invalid_fields",message:"Данные конфликтуют с сохранёнными записями или нарушают ограничения."}},422);
  // Validator failures contain only field names/messages; DB internals never leave the server.
  if(error instanceof Error && !code && !error.stack?.includes("pg-pool") && /^(Тип|Название|Описание|Автор|Исходн|Происхождение|Дата|История|Текущ|Версия|Идентификатор|Запись|Записи|Связь|Проект|Рабоч|Испытание|Число|Успешн|Измеренн|Узел|Для|Повтор|Новый|Новое|Новая|Импорт|Манифест|Сохран|Статус|Снимок|Предыдущ|Конфликт|В проекте|Достигнут|Поле|Единица|Критерий|Условия|Текст|Пара|Измерения|Участник)/u.test(error.message))
    return response({error:{code:"invalid_fields",message:error.message}},422);
  console.error(JSON.stringify({level:"error",event:"workspace_request_failed",code:code||"internal"}));
  return response({error:{code:"service_unavailable",message:"Не удалось сохранить данные. Исходные записи не изменены; повторите позже."}},503);
}
export async function GET(request:Request) {
  try {
    const user=await getCurrentUser();
    if(!user)return response({error:{code:"unauthenticated",message:"Войдите в аккаунт."}},401);
    const params=new URL(request.url).searchParams;
    return response(await getWorkspace({id:user.id,displayName:user.displayName,locale:user.locale},{team:params.get("team"),project:params.get("project")}));
  }catch(error){return errorResponse(error);}
}
export async function POST(request:Request) {
  try{
    const origin=accountOrigin(request.url,request.headers);
    const user=await getCurrentUser();
    if(!user)return response({error:{code:"unauthenticated",message:"Войдите в аккаунт."}},401);
    const queueOwner=request.headers.get('X-TraceLab-Queue-Owner');
    if(queueOwner && queueOwner!==user.id)return response({error:{code:'queue_owner_mismatch',message:'Войдите в аккаунт, создавший этот черновик.'}},403);
    const raw=await readAccountJson(request,2*1024*1024+32768);
    return response(await executeWorkspaceCommand({id:user.id,displayName:user.displayName,locale:user.locale},raw,{origin}));
  }catch(error){return errorResponse(error);}
}


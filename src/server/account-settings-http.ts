import { cookies } from "next/headers";
import { ZodError } from "zod";
import { getCurrentUser } from "./auth";
import { AccountError, accountHash } from "./account-contract";
import { accountResponse } from "./account-http";

export async function accountSettingsIdentity(){
  const [user,jar]=await Promise.all([getCurrentUser(),cookies()]);
  const token=jar.get("pt_session")?.value;
  if(!user||!token)throw new AccountError("unauthenticated",401);
  return {userId:user.id,sessionHash:accountHash(token)};
}
export function accountSettingsFailure(error:unknown){
  if(error instanceof AccountError)return accountResponse({ok:false,code:error.code},error.status);
  if(error instanceof ZodError)return accountResponse({ok:false,code:"invalid_fields"},422);
  console.error(JSON.stringify({level:"error",event:"account_settings_failed"}));
  return accountResponse({ok:false,code:"service_unavailable"},503);
}

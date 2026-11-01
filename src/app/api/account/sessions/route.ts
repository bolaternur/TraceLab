import { cookies } from "next/headers";
import { accountOrigin, readAccountJson } from "@/server/account-contract";
import { accountResponse } from "@/server/account-http";
import { accountSettingsFailure, accountSettingsIdentity } from "@/server/account-settings-http";
import { getAccountSettings, revokeAccountSessions } from "@/server/account-settings-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(){
  try{return accountResponse(await getAccountSettings(await accountSettingsIdentity()));}
  catch(error){return accountSettingsFailure(error);}
}
export async function POST(request:Request){
  try{
    accountOrigin(request.url,request.headers);
    const identity=await accountSettingsIdentity();
    const result=await revokeAccountSessions(identity,await readAccountJson(request,4096));
    if(result.signedOut){const jar=await cookies();jar.delete("pt_session");jar.delete("pt_team");}
    return accountResponse({ok:true,...result});
  }catch(error){return accountSettingsFailure(error);}
}

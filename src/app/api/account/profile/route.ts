import { cookies } from "next/headers";
import { accountOrigin, readAccountJson } from "@/server/account-contract";
import { accountResponse } from "@/server/account-http";
import { accountSettingsFailure, accountSettingsIdentity } from "@/server/account-settings-http";
import { updateAccountProfile } from "@/server/account-settings-service";

export const runtime="nodejs";
export async function PATCH(request:Request){
  try{
    accountOrigin(request.url,request.headers);
    const identity=await accountSettingsIdentity();
    const profile=await updateAccountProfile(identity,await readAccountJson(request,4096));
    (await cookies()).set("pt_lang",profile.locale,{path:"/",sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:31_536_000});
    return accountResponse({ok:true,profile});
  }catch(error){return accountSettingsFailure(error);}
}

import { redirect } from "next/navigation";
import { AccountError } from "@/server/account-contract";
import { accountSettingsIdentity } from "@/server/account-settings-http";
import { getAccountSettings } from "@/server/account-settings-service";
import { AccountSettingsForm } from "./settings-form";
import "../auth/account.css";
import "./settings.css";

export const dynamic="force-dynamic";
export const metadata={title:"TraceLab · Account settings",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function AccountPage(){
  let initial;
  try{initial=await getAccountSettings(await accountSettingsIdentity());}
  catch(error){if(error instanceof AccountError&&error.status===401)redirect("/auth?next=%2Faccount");throw error;}
  return <AccountSettingsForm initial={initial}/>;
}

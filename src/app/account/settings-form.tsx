"use client";
import { useRef,useState,type FormEvent } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { useRouter } from "next/navigation";
import type { AccountSettings } from "@/server/account-settings-contract";
import { settingsCopy } from "./account-settings-copy";

type Locale=keyof typeof settingsCopy;
async function clearLocalAccountContext(){
  navigator.serviceWorker?.controller?.postMessage("clear-private-data");
  if(!globalThis.indexedDB)return;
  // Keep queued drafts, but prevent offline capture under the signed-out identity.
  await new Promise<void>(resolve=>{
    const request=indexedDB.open("tracelab-team-outbox-v1",1);
    request.onupgradeneeded=()=>{request.transaction?.abort();};
    request.onerror=request.onblocked=()=>resolve();
    request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains("context")){db.close();resolve();return;}
      const transaction=db.transaction("context","readwrite");transaction.objectStore("context").delete("active");
      transaction.oncomplete=transaction.onabort=transaction.onerror=()=>{db.close();resolve();};};
  });
}
export function AccountSettingsForm({initial}:{initial:AccountSettings}){
  const router=useRouter();
  const [locale,setLocale]=useState<Locale>(initial.profile.locale in settingsCopy?initial.profile.locale:"en");
  const [name,setName]=useState(initial.profile.displayName),[data,setData]=useState(initial);
  const [pending,setPending]=useState(false),[message,setMessage]=useState<""|"saved"|"done"|"error"|"invalid"|"expired">("");
  const [confirmAll,setConfirmAll]=useState(false),busy=useRef(false),copy=settingsCopy[locale];
  const date=(value:string)=>new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(value))+" UTC";
  async function request(path:string,options?:RequestInit){
    const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...options});
    const result=await response.json();
    if(!response.ok){setMessage(response.status===401?"expired":result.code==="invalid_fields"?"invalid":"error");return null;}
    return result;
  }
  async function work(callback:()=>Promise<void>){if(busy.current)return;busy.current=true;setPending(true);setMessage("");try{await callback();}catch{setMessage("error");}finally{busy.current=false;setPending(false);}}
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();void work(async()=>{
    const result=await request("/api/account/profile",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({displayName:name,locale})});
    if(!result)return;setName(result.profile.displayName);setData(value=>({...value,profile:result.profile}));setMessage("saved");document.documentElement.lang=locale;
    try{localStorage.setItem("tracelab-locale",locale);}catch{}
  });}
  const refresh=()=>work(async()=>{const result=await request("/api/account/sessions");if(result){setData(result);setMessage("done");}});
  function revoke(action:"revoke_one"|"revoke_others"|"revoke_all",sessionId?:string){void work(async()=>{
    const result=await request("/api/account/sessions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...(sessionId?{sessionId}:{})})});
    if(!result)return;
    if(result.signedOut){await clearLocalAccountContext().catch(()=>{});router.replace("/auth?next=%2Faccount&locale="+locale);router.refresh();return;}
    const latest=await request("/api/account/sessions");if(latest){setData(latest);setMessage("done");}
  });}
  return <main id="main" className="account-page settings-page" lang={locale}><div className="settings-container">
    <header className="settings-header"><Link href="/" prefetch={false} className="account-brand" aria-label="Iznera"><BrandLogo /></Link><a href="/workspace/">← {copy.back}</a></header>
    <h1>{copy.title}</h1><p className="account-intro">{copy.intro}</p>
    {message?<div className={"account-message"+(["error","invalid","expired"].includes(message)?" is-error":"")} role="status">{copy[message]}{message==="expired"?<p><a href="/auth?next=%2Faccount">{copy.signin} →</a></p>:null}</div>:null}
    <section className="settings-panel" aria-labelledby="profile-heading"><h2 id="profile-heading">{copy.profile}</h2>
      <form onSubmit={submit}><label>{copy.name}<input required autoComplete="name" maxLength={80} value={name} onChange={event=>setName(event.target.value)} disabled={pending}/></label>
        <label>{copy.email}<input type="email" value={data.profile.email} readOnly autoComplete="email"/></label><p className="settings-note">{copy.emailHint}</p>
        <label>{copy.language}<select value={locale} onChange={event=>{setLocale(event.target.value as Locale);setMessage("");}} disabled={pending}><option value="ru">Русский</option><option value="en">English</option><option value="kk">Қазақша</option></select></label>
        <button className="account-primary" disabled={pending}>{pending?copy.saving:copy.save}</button>
      </form>
    </section>
    <section className="settings-panel" aria-labelledby="sessions-heading"><div className="settings-section-title"><h2 id="sessions-heading">{copy.sessions}</h2><button disabled={pending} onClick={()=>void refresh()}>{copy.refresh}</button></div><p className="settings-note">{copy.sessionHint}</p>
      <ul className="settings-sessions">{data.sessions.map(session=><li key={session.id}><div><strong>{session.current?copy.current:copy.other}</strong><p>{copy.created}: <time dateTime={session.createdAt}>{date(session.createdAt)}</time></p><p>{copy.expires}: <time dateTime={session.expiresAt}>{date(session.expiresAt)}</time></p></div>
        <button disabled={pending} onClick={()=>revoke("revoke_one",session.id)}>{copy.revoke}</button></li>)}</ul>
      {data.hasMore?<p className="settings-note">{copy.more}</p>:null}
      <div className="settings-actions"><button disabled={pending||(!data.hasMore&&data.sessions.every(row=>row.current))} onClick={()=>revoke("revoke_others")}>{copy.others}</button><button disabled={pending} onClick={()=>setConfirmAll(true)}>{copy.all}</button></div>
      {confirmAll?<div className="settings-confirm" role="group" aria-label={copy.all}><p>{copy.confirm}</p><p className="settings-note">{copy.offlineHint}</p><div className="settings-actions"><button disabled={pending} onClick={()=>revoke("revoke_all")}>{pending?copy.busy:copy.yes}</button><button disabled={pending} onClick={()=>setConfirmAll(false)}>{copy.cancel}</button></div></div>:null}
    </section>
    <section className="settings-panel"><h2>{copy.password}</h2><p className="settings-note">{copy.passwordHint}</p><a href={"/auth?mode=forgot&next=%2Faccount&locale="+locale}>{copy.reset} →</a></section>
  </div></main>;
}

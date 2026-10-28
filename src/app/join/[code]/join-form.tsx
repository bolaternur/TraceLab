"use client";
import {useRef,useState,type FormEvent} from "react";
import Link from "next/link";
import {isTeamCodeInput,joinCopy,joinErrorKey,type JoinLocale} from "../join-copy";

export function JoinForm({code='',locale:initialLocale,embedded=false}:{code?:string;locale:string;embedded?:boolean}) {
  const [chosenLocale,setLocale]=useState<JoinLocale>(initialLocale==='en'||initialLocale==='kk'?initialLocale:'ru');
  const locale=embedded?(initialLocale==='en'||initialLocale==='kk'?initialLocale:'ru'):chosenLocale;
  const [value,setValue]=useState(code),[pending,setPending]=useState(false),[error,setError]=useState<keyof typeof joinCopy.ru|null>(null);
  const busy=useRef(false),request=useRef({token:'',id:''});
  const legacy=/^[A-Za-z0-9_-]{43}$/.test(code),t=joinCopy[locale];
  function language(value:JoinLocale){setLocale(value);document.documentElement.lang=value;document.cookie=`pt_lang=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;try{localStorage.setItem('tracelab-locale',value);}catch{}}
  async function submit(event:FormEvent){
    event.preventDefault();if(busy.current)return;setError(null);
    const token=legacy?code:value.trim();
    if(!legacy&&!isTeamCodeInput(token)){setError('invalid');return;}
    if(request.current.token!==token)request.current={token,id:crypto.randomUUID()};
    busy.current=true;setPending(true);
    try{
      const response=await fetch('/api/workspace',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:'joinInvite',requestId:request.current.id,args:[{token}]})});
      const data=await response.json();
      if(!response.ok){setError(joinErrorKey(data.error?.code||''));if(response.status<500)request.current={token:'',id:''};return;}
      const teamId=data.team?.id||data.result?.teamId;
      if(typeof teamId!=='string'){setError('service');return;}
      const params=new URLSearchParams({team:teamId});if(data.activeProjectId)params.set('project',data.activeProjectId);
      // The workspace is a standalone HTML document, outside the React router.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      location.assign('/workspace/?'+params);
    }catch{setError('network');}
    finally{busy.current=false;setPending(false);}
  }
  return <section className="tl-join-content" lang={locale}>
    {!embedded?<label className="tl-join-language">{t.language}<select value={locale} onChange={event=>language(event.target.value as JoinLocale)} disabled={pending}><option value="ru">Русский</option><option value="en">English</option><option value="kk">Қазақша</option></select></label>:null}
    {embedded?<h2>{t.title}</h2>:<h1>{t.title}</h1>}<p>{t.note}</p>
    <form onSubmit={submit} className="tl-join-form">
      {legacy?<p>{t.invite}</p>:<label>{t.code}<input name="code" value={value} onChange={event=>{setValue(event.target.value);setError(null);}} autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={64} aria-describedby="team-code-hint" aria-invalid={error==='invalid'||error==='unavailable'} className="tl-team-code"/><span id="team-code-hint" className="tl-setup-hint">{t.hint}</span></label>}
      <p className="tl-setup-privacy">{t.member}</p>
      {error?<p role="alert" className="tl-setup-error">{t[error]}{error==='signin'?<> <Link href={'/auth?mode=signin&invite='+encodeURIComponent(legacy?code:value.trim())}>{t.signInAction}</Link></>:null}</p>:null}
      <button type="submit" disabled={pending}>{pending?t.pending:legacy?t.accept:t.join}</button>
    </form>
    {!embedded?<nav className="tl-join-links"><Link href="/workspace/">{t.back}</Link><Link href="/onboarding">{t.newTeam}</Link></nav>:null}
  </section>;
}

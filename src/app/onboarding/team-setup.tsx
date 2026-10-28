'use client';
import {useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {BrandLogo} from '@/components/brand-logo';
import {JoinForm} from '../join/[code]/join-form';

const copy={
  ru:{title:'Начните с вашей команды',subtitle:'Создайте команду или введите код от руководителя. У каждого участника свой аккаунт и общая история работы.',createChoice:'Создать команду',joinChoice:'У меня есть код',choice:'Как начать?',team:'Название команды',project:'Название проекта',season:'Сезон',program:'Программа',zone:'Часовой пояс',create:'Создать команду бесплатно',pending:'Создаём команду…',home:'На главную',open:'Открыть рабочую область',error:'Не удалось сохранить. Проверьте соединение и обязательные поля, затем повторите.',limited:'Слишком много попыток. Подождите 15 минут и повторите.',language:'Язык',privacy:'Материалы доступны только участникам команды. После создания руководитель может получить код в меню «Проект → Код команды». Все функции бесплатны.',next:'Продолжить',back:'Назад',basics:'Команда и проект',review:'Проверьте параметры'},
  en:{title:'Start with your team',subtitle:'Create a team or enter the code from your lead. Everyone has their own account and a shared history of work.',createChoice:'Create a team',joinChoice:'I have a team code',choice:'Choose how to start',team:'Team name',project:'Project name',season:'Season',program:'Program',zone:'Time zone',create:'Create a team — free',pending:'Creating your team…',home:'Home',open:'Open workspace',error:'Could not save. Check the connection and required fields, then try again.',limited:'Too many attempts. Wait 15 minutes and try again.',language:'Language',privacy:'Only team members can access your evidence. After creation, the lead can get a code from Project → Team code. All features are free.',next:'Continue',back:'Back',basics:'Team and project',review:'Review your settings'},
  kk:{title:'Өз командаңыздан бастаңыз',subtitle:'Команда құрыңыз немесе жетекші берген кодты енгізіңіз. Әр қатысушының өз аккаунты және ортақ жұмыс тарихы бар.',createChoice:'Команда құру',joinChoice:'Команда коды бар',choice:'Қалай бастайсыз?',team:'Команда атауы',project:'Жоба атауы',season:'Маусым',program:'Бағдарлама',zone:'Уақыт белдеуі',create:'Команданы тегін құру',pending:'Команда құрылуда…',home:'Басты бет',open:'Жұмыс кеңістігін ашу',error:'Сақталмады. Байланыс пен міндетті өрістерді тексеріп, қайталаңыз.',limited:'Әрекет тым көп. 15 минут күтіп, қайталаңыз.',language:'Тіл',privacy:'Материалдар тек команда қатысушыларына қолжетімді. Құрғаннан кейін жетекші «Жоба → Команда коды» мәзірінен код алады. Барлық мүмкіндіктер тегін.',next:'Жалғастыру',back:'Артқа',basics:'Команда және жоба',review:'Параметрлерді тексеріңіз'},
} as const;
type Locale=keyof typeof copy;
export function TeamSetup({initialLocale}:{initialLocale:string}){
  const [locale,setLocale]=useState<Locale>(initialLocale in copy?initialLocale as Locale:'ru');
  const [mode,setMode]=useState<'create'|'join'>('join'),[step,setStep]=useState(0),[pending,setPending]=useState(false),[error,setError]=useState('');
  const form=useRef<HTMLFormElement>(null),requestKey=useRef({body:'',id:''}),busy=useRef(false),text=copy[locale];
  function language(value:Locale){setLocale(value);document.documentElement.lang=value;document.cookie=`pt_lang=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;try{localStorage.setItem('tracelab-locale',value);}catch{}}
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy.current)return;setError('');
    const fields=new FormData(event.currentTarget),args={teamName:fields.get('teamName'),projectName:fields.get('projectName'),seasonName:fields.get('seasonName'),program:fields.get('program'),timezone:fields.get('timezone'),locale};
    const body=JSON.stringify(args);if(requestKey.current.body!==body)requestKey.current={body,id:crypto.randomUUID()};busy.current=true;setPending(true);
    try{
      const response=await fetch('/api/workspace',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:'createTeam',requestId:requestKey.current.id,args:[args]})});
      const data=await response.json();if(!response.ok){setError(data.error?.code==='rate_limited'?text.limited:text.error);return;}
      const params=new URLSearchParams({view:'timeline'});if(data.activeProjectId)params.set('project',data.activeProjectId);if(data.team?.id)params.set('team',data.team.id);
      // Workspace is generated standalone HTML, so entering it requires a document navigation.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      location.assign('/workspace/?'+params);
    }catch{setError(text.error);}finally{busy.current=false;setPending(false);}
  }
  function next(){const controls=form.current?.querySelectorAll<HTMLInputElement>('[data-step="basics"] input');if(controls&&[...controls].every(input=>input.reportValidity()))setStep(1);}
  return <main id="main" className="tl-setup" lang={locale}>
    <header><Link href="/" aria-label={text.home}><BrandLogo /></Link><label>{text.language}<select value={locale} onChange={event=>language(event.target.value as Locale)} disabled={pending}><option value="ru">Русский</option><option value="en">English</option><option value="kk">Қазақша</option></select></label></header>
    <div className="tl-setup-content"><h1>{text.title}</h1><p>{text.subtitle}</p>
      <div className="tl-setup-choice" role="group" aria-label={text.choice}><button type="button" disabled={pending} aria-pressed={mode==='join'} className={mode==='join'?'':'secondary'} onClick={()=>setMode('join')}>{text.joinChoice}</button><button type="button" disabled={pending} aria-pressed={mode==='create'} className={mode==='create'?'':'secondary'} onClick={()=>setMode('create')}>{text.createChoice}</button></div>
      <section className="tl-setup-join" hidden={mode!=='join'}><JoinForm locale={locale} embedded/></section>
      <form ref={form} onSubmit={submit} hidden={mode!=='create'}><h2>{step===0?text.basics:text.review}</h2>
        <section data-step="basics" hidden={step!==0}><label>{text.team}<input name="teamName" autoComplete="organization" required maxLength={120}/></label><label>{text.project}<input name="projectName" required maxLength={120}/></label></section>
        <section hidden={step!==1}><label>{text.season}<input name="seasonName" required maxLength={60} defaultValue={`${new Date().getFullYear()}–${new Date().getFullYear()+1}`}/></label><label>{text.program}<select name="program" defaultValue="OTHER"><option>FTC</option><option>FRC</option><option>VEX</option><option>ISEF</option><option value="OTHER">{locale==='ru'?'Другая':locale==='kk'?'Басқа':'Other'}</option></select></label><label>{text.zone}<input name="timezone" required maxLength={80} defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}/></label><p className="tl-setup-privacy">{text.privacy}</p></section>
        {error?<p role="alert" className="tl-setup-error">{error}</p>:null}
        <div className="tl-setup-actions">{step===0?<button type="button" onClick={next}>{text.next}</button>:<><button type="button" className="secondary" disabled={pending} onClick={()=>setStep(0)}>{text.back}</button><button type="submit" disabled={pending}>{pending?text.pending:text.create}</button></>}</div>
      </form>
      <Link href="/workspace/">{text.open}</Link>
    </div>
  </main>;
}

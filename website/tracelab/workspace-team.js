import {teamText as t,teamErrorText} from './workspace-team-copy.js';
import {formatDate,formatNumber} from './workspace-i18n.js';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const button=(text,action)=>{const node=el('button','wm-button',text);node.type='button';node.addEventListener('click',action);return node;};
const field=(form,label,value,type='text')=>{const wrap=el('label','wm-field',label),input=el('input');input.type=type;input.value=value;wrap.append(input);form.append(wrap);return input;};
export function mountWorkspaceTeam(container,{teamId,onChanged=()=>{}}={}){
  const abort=new AbortController(),root=el('section','wm-library'),status=el('p','wm-status'),body=el('div','wm-form');let disposed=false,dialog=null,loading=false;
  status.setAttribute('role','status');const header=el('header','wm-heading'),heading=el('div');heading.append(el('h2','',t('title')),el('p','',t('intro')));header.append(heading,button(t('refresh'),()=>load()));root.append(header,status,body);container.replaceChildren(root);
  async function send(payload){const response=await fetch('/api/workspace/team',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,teamId}),signal:abort.signal}),data=await response.json();if(!response.ok)throw new Error(teamErrorText(data.error?.code));return data;}
  async function mutate(control,payload){control.disabled=true;status.textContent=t('loading');try{const result=await send(payload);if(result.selfAccessRemoved){location.assign('/workspace');return;}await onChanged();if(!disposed){await load();status.textContent=t('saved');}}catch(error){if(!disposed)status.textContent=error.message;}finally{control.disabled=false;}}
  async function load(){if(loading||disposed)return;loading=true;status.textContent=t('loading');try{const response=await fetch('/api/workspace/team?'+new URLSearchParams({team:teamId}),{credentials:'same-origin',cache:'no-store',signal:abort.signal}),data=await response.json();if(!response.ok)throw new Error(teamErrorText(data.error?.code));if(disposed)return;paint(data);status.textContent='';}catch(error){if(!disposed)status.textContent=error.message;}finally{loading=false;}}
  function paint(data){body.replaceChildren();const writable=data.role==='student_lead',settings=el('form','wm-form');settings.append(el('h3','',t('settings')));const name=field(settings,t('name'),data.team.name),zone=field(settings,t('timezone'),data.team.timezone);name.required=true;name.maxLength=120;zone.required=true;zone.maxLength=80;const langLabel=el('label','wm-field',t('locale')),lang=el('select');for(const [value,label]of [['ru','Русский'],['en','English'],['kk','Қазақша']]){const option=el('option','',label);option.value=value;lang.append(option);}lang.value=data.team.locale;langLabel.append(lang);settings.append(langLabel);for(const input of [name,zone,lang])input.disabled=!writable;
    if(writable){const save=button(t('save'),()=>{});save.type='submit';settings.append(save);settings.addEventListener('submit',event=>{event.preventDefault();mutate(save,{command:'settings',name:name.value,timezone:zone.value,locale:lang.value,expectedVersion:data.team.version});});}else settings.append(el('p','wm-meta',t('readonly')));
    body.append(settings,el('h3','',t('members')),el('p','wm-meta',t('roleHint')),el('p','wm-meta',`${t('memberCount')}: ${formatNumber(data.members.length)} / ${formatNumber(data.memberTotal)}`));
    const members=el('div','wm-grid'),leadCount=data.members.filter(member=>member.status==='active'&&member.role==='student_lead').length;
    for(const member of data.members){const card=el('article','wm-card'),info=el('div','wm-card-info');info.append(el('h4','',member.displayName+(member.isSelf?' · '+t('self'):'')),el('p','wm-meta',`${t(member.role)} · ${t(member.status)}`));
      if(writable&&member.role!=='coach'){const actions=el('div','wm-form');if(member.status==='active'){
        const lastLead=member.role==='student_lead'&&leadCount===1,select=el('select');select.setAttribute('aria-label',t('roles')+': '+member.displayName);for(const value of ['student','student_lead']){const option=el('option','',t(value));option.value=value;select.append(option);}select.value=member.role;select.disabled=lastLead;actions.append(select);
        const apply=button(t('apply'),()=>{if(select.value===member.role)return;if(window.confirm(t('confirmRole')))mutate(apply,{command:'changeMember',userId:member.userId,role:select.value,status:'active',expectedRole:member.role,expectedStatus:member.status});});apply.disabled=lastLead;actions.append(apply);
        const remove=button(t('remove'),()=>{if(window.confirm(t('confirmRemove')))mutate(remove,{command:'changeMember',userId:member.userId,role:member.role,status:'removed',expectedRole:member.role,expectedStatus:member.status});});remove.disabled=lastLead;actions.append(remove);if(lastLead)actions.append(el('p','wm-meta',t('lastLead')));
      }else{const restore=button(t('restore'),()=>{if(window.confirm(t('confirmRestore')))mutate(restore,{command:'changeMember',userId:member.userId,role:'student',status:'active',expectedRole:member.role,expectedStatus:member.status});});actions.append(restore);}info.append(actions);}
      card.append(info);members.append(card);}
    body.append(members);
    if(writable){const inviteHeading=el('div','wm-heading');inviteHeading.append(el('h3','',t('invites')),button(t('createCode'),()=>openWorkspaceTeamCode({teamId,onCreated:load})),button(t('invite'),()=>showInvite()));body.append(inviteHeading,el('p','wm-meta',t('codeHint')));if(!data.invites.length)body.append(el('p','wm-empty',t('inviteEmpty')));
      for(const invite of data.invites){const state=invite.revokedAt?'revoked':invite.uses>=invite.maxUses?'used':new Date(invite.expiresAt).getTime()<Date.now()?'expired':'available',row=el('article','wm-card-info');row.append(el('strong','',invite.kind==='team_code'?t('teamCode'):invite.email||t('student')),el('p','wm-meta',`${t(state)} · ${t('expires')}: ${formatDate(invite.expiresAt)}`),el('p','wm-meta',`${t('uses')}: ${formatNumber(invite.uses)} / ${formatNumber(invite.maxUses)}`));if(state==='available'){const revoke=button(t('revoke'),()=>{if(window.confirm(t('confirmRevoke')))mutate(revoke,{command:'revokeInvite',inviteId:invite.id});});row.append(revoke);}body.append(row);}}
  }
  function showInvite(){dialog?.close();const modal=el('dialog','wm-dialog'),form=el('form','wm-form'),title=el('h2','',t('invite'));form.append(title);modal.setAttribute('aria-label',t('invite'));const email=field(form,t('email'),'','email');email.maxLength=254;form.append(el('p','wm-meta',t('emailHint')));const error=el('p','wm-status');error.setAttribute('role','status');const create=button(t('create'),()=>{});create.type='submit';form.append(error,create,button(t('close'),()=>modal.close()));let requestId=crypto.randomUUID(),lastEmail='';
    form.addEventListener('submit',async event=>{event.preventDefault();create.disabled=true;error.textContent=t('loading');const value=email.value.trim();if(lastEmail!==value)requestId=crypto.randomUUID();lastEmail=value;
      try{const response=await fetch('/api/workspace',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:'createInvite',teamId,requestId,args:[value?{email:value}:{}]}),signal:abort.signal}),data=await response.json();if(!response.ok)throw new Error(teamErrorText(data.error?.code));
        create.remove();email.disabled=true;error.textContent=t('saved');const link=field(form,t('link'),data.result.inviteUrl);link.readOnly=true;form.append(el('p','wm-meta',t('expires')+': '+formatDate(data.result.expiresAt)));await load();
      }catch(e){error.textContent=e.message;create.disabled=false;}});
    modal.append(form);modal.addEventListener('close',()=>{modal.remove();if(dialog===modal)dialog=null;},{once:true});document.body.append(modal);dialog=modal;modal.showModal();email.focus();
  }
  load();return()=>{disposed=true;abort.abort();dialog?.close();};
}

/** The plain code is shown only in this creation dialog; history exposes status. */
export function openWorkspaceTeamCode({teamId,onCreated=()=>{}}={}){
  const modal=el('dialog','wm-dialog'),form=el('form','wm-form'),title=el('h2','',t('teamCode')),status=el('p','wm-status');
  modal.setAttribute('aria-label',t('teamCode'));status.setAttribute('role','status');
  const create=button(t('createCode'),()=>{}),close=button(t('close'),()=>modal.close());create.type='submit';
  form.append(title,el('p','wm-meta',t('codeHint')),el('p','wm-meta',t('codeLimits')),status,create,close);modal.append(form);
  const requestId=crypto.randomUUID(),abort=new AbortController();let busy=false;
  modal.addEventListener('close',()=>{abort.abort();modal.remove();},{once:true});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;busy=true;create.disabled=true;status.textContent=t('loading');
    try{
      const response=await fetch('/api/workspace',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:'createInvite',teamId,requestId,args:[{kind:'team_code',maxUses:50,expiresInDays:14}]}),signal:abort.signal}),data=await response.json();
      if(!response.ok)throw new Error(teamErrorText(data.error?.code));
      const invite=data.result;if(typeof invite?.inviteCode!=='string'||typeof invite?.inviteUrl!=='string')throw new Error(t('error'));
      create.remove();status.textContent=t('codeReady');
      const details=el('div','wm-form'),code=field(details,t('codeLabel'),invite.inviteCode),link=field(details,t('joinLink'),new URL(invite.inviteUrl,location.origin).href);
      code.readOnly=true;code.autocomplete='off';code.spellcheck=false;code.className='wm-team-code';link.readOnly=true;link.autocomplete='off';
      details.append(el('p','wm-meta',t('codeSaveOnce')),el('p','wm-meta',`${t('expires')}: ${formatDate(invite.expiresAt)} · ${t('limit')}: ${formatNumber(invite.maxUses)}`));
      const copy=async(input)=>{try{await navigator.clipboard.writeText(input.value);status.textContent=t('copied');}catch{input.focus();input.select();status.textContent=t('copyManual');}};
      details.append(button(t('copyCode'),()=>copy(code)),button(t('copyJoinLink'),()=>copy(link)));form.insertBefore(details,close);code.focus();code.select();await onCreated();
    }catch(error){if(modal.isConnected){status.textContent=error.message||t('error');create.disabled=false;}}
    finally{busy=false;}
  });
  document.body.append(modal);modal.showModal();create.focus();return()=>modal.close();
}

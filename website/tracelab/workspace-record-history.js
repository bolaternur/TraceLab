import {getWorkspaceLocale,formatDate} from './workspace-i18n.js';
const copy={
  ru:{title:'История авторских версий',note:'Исходная запись сохранена. Изменения добавляются отдельными версиями.',current:'Текущая',original:'Исходная',conflict:'Вариант для сравнения',why:'Обоснование',drafts:'Мои сохранённые спорные варианты',open:'Открыть вариант в редакторе',draftNote:'Эти варианты не заменили текущую запись. Сравните текст и сохраните подходящие изменения вручную.'},
  en:{title:'Authored version history',note:'The original record is preserved. Edits are appended as separate versions.',current:'Current',original:'Original',conflict:'Variant to compare',why:'Rationale',drafts:'My saved conflicting drafts',open:'Open draft in editor',draftNote:'These drafts did not replace the current record. Compare the text and save your chosen edits manually.'},
  kk:{title:'Авторлық нұсқалар тарихы',note:'Бастапқы жазба сақталады. Өзгерістер бөлек нұсқа ретінде қосылады.',current:'Ағымдағы',original:'Бастапқы',conflict:'Салыстыру нұсқасы',why:'Негіздеме',drafts:'Менің сақталған қайшы нобайларым',open:'Нобайды редакторда ашу',draftNote:'Бұл нобайлар ағымдағы жазбаны алмастырған жоқ. Мәтінді салыстырып, тиісті өзгерістерді қолмен сақтаңыз.'},
};
export function appendRecordHistory(container,record){
  const history=record.recordHistory;if(!history?.versions?.length)return;
  const text=copy[getWorkspaceLocale()],details=document.createElement('details');details.className='ws-note-history';
  const title=document.createElement('summary');title.textContent=`${text.title} · ${history.versions.length}`;details.append(title);
  const note=document.createElement('p');note.textContent=text.note;details.append(note);
  for(const version of [...history.versions].reverse()){
    const item=document.createElement('details'),summary=document.createElement('summary'),snapshot=version.snapshot;
    const state=version.id===history.currentVersionId?text.current:version.previousVersionId===null?text.original:history.conflictVersionIds?.includes(version.id)?text.conflict:'';
    summary.textContent=`${formatDate(version.recordedAt)}${state?' · '+state:''}`;item.append(summary);
    for(const [tag,value] of [['h3',snapshot.title],['p',snapshot.body],['p',snapshot.rationale?`${text.why}: ${snapshot.rationale}`:''],['small',snapshot.author]]){if(!value)continue;const node=document.createElement(tag);node.textContent=value;item.append(node);}
    details.append(item);
  }
  container.append(details);
}
export function appendConflictingDrafts(container,drafts,onOpen){
  if(!drafts?.length)return;const text=copy[getWorkspaceLocale()],details=document.createElement('details');details.className='ws-note-history';
  const title=document.createElement('summary');title.textContent=`${text.drafts} · ${drafts.length}`;details.append(title);const note=document.createElement('p');note.textContent=text.draftNote;details.append(note);
  for(const draft of drafts){const item=document.createElement('article'),time=document.createElement('small');time.textContent=formatDate(draft.createdAt);item.append(time);
    for(const value of [draft.record.title,draft.record.body,draft.record.rationale]){if(!value)continue;const p=document.createElement('p');p.textContent=value;item.append(p);}
    const open=document.createElement('button');open.type='button';open.className='ws-tool-button';open.textContent=text.open;open.addEventListener('click',()=>onOpen(draft));item.append(open);details.append(item);
  }container.append(details);
}

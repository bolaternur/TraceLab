import {formatDayKey,getWorkspaceLocale,getWorkspaceTimeZone} from './workspace-i18n.js';
import {recordIterationIds} from './workspace-iterations-model.js';

const copy={
  ru:{filters:'Фильтры истории',from:'С даты',to:'По дату',author:'Автор',all:'Все авторы',order:'Порядок',newest:'Сначала новые',oldest:'Сначала ранние',reset:'Сбросить',zone:'Часовой пояс команды',empty:'Нет записей по этим условиям',subsystem:'Подсистема',allSubsystems:'Все подсистемы',iteration:'Итерация',allIterations:'Все итерации',group:'Представление',day:'Лента по дням',subsystemGroup:'По подсистемам',iterationGroup:'По итерациям',missing:'Недоступный выбор',remove:'Убрать фильтр',active:'Активные фильтры'},
  en:{filters:'History filters',from:'From date',to:'To date',author:'Author',all:'All authors',order:'Order',newest:'Newest first',oldest:'Oldest first',reset:'Reset',zone:'Team time zone',empty:'No records match these conditions',subsystem:'Subsystem',allSubsystems:'All subsystems',iteration:'Iteration',allIterations:'All iterations',group:'View',day:'Daily feed',subsystemGroup:'By subsystem',iterationGroup:'By iteration',missing:'Unavailable selection',remove:'Remove filter',active:'Active filters'},
  kk:{filters:'Тарих сүзгілері',from:'Басталу күні',to:'Аяқталу күні',author:'Автор',all:'Барлық автор',order:'Реті',newest:'Алдымен жаңасы',oldest:'Алдымен ертесі',reset:'Тазарту',zone:'Команданың уақыт белдеуі',empty:'Бұл шарттарға сай жазба жоқ',subsystem:'Ішкі жүйе',allSubsystems:'Барлық ішкі жүйелер',iteration:'Итерация',allIterations:'Барлық итерациялар',group:'Көрініс',day:'Күндер бойынша',subsystemGroup:'Ішкі жүйелер бойынша',iterationGroup:'Итерациялар бойынша',missing:'Қолжетімсіз таңдау',remove:'Сүзгіні алып тастау',active:'Белсенді сүзгілер'},
};
const day=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '';const parsed=new Date(value+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?value:'';};
export function readHistoryFilters(params){return{from:day(params.get('from')),to:day(params.get('to')),author:(params.get('author')||'').slice(0,160),subsystem:(params.get('subsystem')||'').slice(0,120),iteration:(params.get('iteration')||'').slice(0,80),group:['subsystem','iteration'].includes(params.get('group'))?params.get('group'):'day',order:params.get('order')==='oldest'?'oldest':'newest'};}
export function filterHistoryRecords(records,filters,project={records,links:[]}){
  return records.filter(record=>{const key=formatDayKey(record.createdAt);return(!filters.author||record.author===filters.author)&&(!filters.subsystem||record.subsystem===filters.subsystem)&&(!filters.iteration||recordIterationIds(record,project).includes(filters.iteration))&&(!filters.from||(key!=='unknown'&&key>=filters.from))&&(!filters.to||(key!=='unknown'&&key<=filters.to));});
}
export function mountHistoryFilters(host,onChange){
  const details=document.createElement('details');details.className='ws-history-filters';
  const summary=document.createElement('summary'),form=document.createElement('div');form.className='ws-history-filter-fields';details.append(summary,form);host.after(details);
  const chips=document.createElement('div');chips.className='ws-history-filter-chips';details.after(chips);
  const fields={};
  for(const name of ['group','subsystem','iteration','from','to','author','order']){const label=document.createElement('label'),caption=document.createElement('span'),control=document.createElement(['author','order','group','subsystem','iteration'].includes(name)?'select':'input');if(control.tagName==='INPUT')control.type='date';label.append(caption,control);form.append(label);fields[name]={caption,control};control.addEventListener('change',()=>{const url=new URL(location.href);for(const [key,{control:item}] of Object.entries(fields)){if(item.value&&item.value!=='newest'&&!(key==='group'&&item.value==='day'))url.searchParams.set(key,item.value);else url.searchParams.delete(key);}history.replaceState(null,'',url);onChange();});}
  const reset=document.createElement('button');reset.type='button';reset.className='ws-tool-button';reset.addEventListener('click',()=>{const url=new URL(location.href);for(const key of Object.keys(fields))url.searchParams.delete(key);history.replaceState(null,'',url);onChange();});
  const note=document.createElement('small');form.append(reset,note);
  return{render(project,visible){
    details.hidden=!visible;chips.hidden=!visible;const text=copy[getWorkspaceLocale()],state=readHistoryFilters(new URLSearchParams(location.search));
    const active=['subsystem','iteration','from','to','author'].filter(name=>state[name]);
    summary.textContent=text.filters+(active.length?' · '+active.length:'');
    for(const [name,{caption}] of Object.entries(fields))caption.textContent=text[name];
    function options(control,items){control.replaceChildren(...items.map(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;return option;}));}
    const authors=[...new Set(project.records.map(item=>item.author).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    if(state.author&&!authors.includes(state.author))authors.push(state.author);
    options(fields.author.control,[['',text.all],...authors.map(value=>[value,value])]);
    options(fields.order.control,[['newest',text.newest],['oldest',text.oldest]]);
    options(fields.group.control,[['day',text.day],['subsystem',text.subsystemGroup],['iteration',text.iterationGroup]]);
    const subsystems=[...new Set(project.records.map(item=>item.subsystem).filter(Boolean))].sort((a,b)=>a.localeCompare(b));if(state.subsystem&&!subsystems.includes(state.subsystem))subsystems.push(state.subsystem);
    options(fields.subsystem.control,[['',text.allSubsystems],...subsystems.map(value=>[value,value])]);
    const iterations=project.records.filter(item=>item.kind==='iteration').map(item=>[item.id,item.title]);if(state.iteration&&!iterations.some(([id])=>id===state.iteration))iterations.push([state.iteration,text.missing]);
    options(fields.iteration.control,[['',text.allIterations],...iterations]);
    for(const [name,{control}] of Object.entries(fields))control.value=state[name];
    fields.to.control.min=state.from;fields.from.control.max=state.to;
    reset.textContent=text.reset;note.textContent=text.zone+': '+getWorkspaceTimeZone();
    chips.replaceChildren();chips.setAttribute('aria-label',text.active);
    for(const name of active){const chip=document.createElement('button');chip.type='button';const value=name==='iteration'?(iterations.find(([id])=>id===state.iteration)?.[1]||text.missing):state[name];chip.textContent=text[name]+': '+value;chip.setAttribute('aria-label',text.remove+': '+chip.textContent);chip.addEventListener('click',()=>{const url=new URL(location.href);url.searchParams.delete(name);history.replaceState(null,'',url);onChange();});chips.append(chip);}
    if(active.length){const clear=document.createElement('button');clear.type='button';clear.textContent=text.reset;clear.addEventListener('click',()=>reset.click());chips.append(clear);}
    chips.hidden=!visible||!active.length;
  }};
}

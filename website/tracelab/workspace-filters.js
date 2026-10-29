import {formatDayKey,getWorkspaceLocale,getWorkspaceTimeZone} from './workspace-i18n.js';

const copy={
  ru:{filters:'Фильтры истории',from:'С даты',to:'По дату',author:'Автор',all:'Все авторы',order:'Порядок',newest:'Сначала новые',oldest:'Сначала ранние',reset:'Сбросить',zone:'Часовой пояс команды',empty:'Нет записей по этим условиям'},
  en:{filters:'History filters',from:'From date',to:'To date',author:'Author',all:'All authors',order:'Order',newest:'Newest first',oldest:'Oldest first',reset:'Reset',zone:'Team time zone',empty:'No records match these conditions'},
  kk:{filters:'Тарих сүзгілері',from:'Басталу күні',to:'Аяқталу күні',author:'Автор',all:'Барлық автор',order:'Реті',newest:'Алдымен жаңасы',oldest:'Алдымен ертесі',reset:'Тазарту',zone:'Команданың уақыт белдеуі',empty:'Бұл шарттарға сай жазба жоқ'},
};
const day=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '';const parsed=new Date(value+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value?value:'';};
export function readHistoryFilters(params){return{from:day(params.get('from')),to:day(params.get('to')),author:(params.get('author')||'').slice(0,160),order:params.get('order')==='oldest'?'oldest':'newest'};}
export function filterHistoryRecords(records,filters){
  return records.filter(record=>{const key=formatDayKey(record.createdAt);return(!filters.author||record.author===filters.author)&&(!filters.from||(key!=='unknown'&&key>=filters.from))&&(!filters.to||(key!=='unknown'&&key<=filters.to));});
}
export function mountHistoryFilters(host,onChange){
  const details=document.createElement('details');details.className='ws-history-filters';
  const summary=document.createElement('summary'),form=document.createElement('div');form.className='ws-history-filter-fields';details.append(summary,form);host.after(details);
  const fields={};
  for(const name of ['from','to','author','order']){const label=document.createElement('label'),caption=document.createElement('span'),control=document.createElement(['author','order'].includes(name)?'select':'input');if(control.tagName==='INPUT')control.type='date';label.append(caption,control);form.append(label);fields[name]={caption,control};control.addEventListener('change',()=>{const url=new URL(location.href);for(const [key,{control:item}] of Object.entries(fields)){if(item.value&&item.value!=='newest')url.searchParams.set(key,item.value);else url.searchParams.delete(key);}history.replaceState(null,'',url);onChange();});}
  const reset=document.createElement('button');reset.type='button';reset.className='ws-tool-button';reset.addEventListener('click',()=>{const url=new URL(location.href);for(const key of Object.keys(fields))url.searchParams.delete(key);history.replaceState(null,'',url);onChange();});
  const note=document.createElement('small');form.append(reset,note);
  return{render(project,visible){
    details.hidden=!visible;const text=copy[getWorkspaceLocale()],state=readHistoryFilters(new URLSearchParams(location.search));
    summary.textContent=text.filters+((state.from||state.to||state.author)?' •':'');
    for(const [name,{caption}] of Object.entries(fields))caption.textContent=text[name];
    function options(control,items){control.replaceChildren(...items.map(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;return option;}));}
    const authors=[...new Set(project.records.map(item=>item.author).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    if(state.author&&!authors.includes(state.author))authors.push(state.author);
    options(fields.author.control,[['',text.all],...authors.map(value=>[value,value])]);
    options(fields.order.control,[['newest',text.newest],['oldest',text.oldest]]);
    for(const [name,{control}] of Object.entries(fields))control.value=state[name];
    fields.to.control.min=state.from;fields.from.control.max=state.to;
    reset.textContent=text.reset;note.textContent=text.zone+': '+getWorkspaceTimeZone();
  }};
}

import {t} from './workspace-i18n.js';

const present=value=>typeof value==='string'&&Boolean(value.trim());
const accepted=link=>!link.status||link.status==='accepted';
// A contradiction, a replacement or a future step is not supporting evidence.
const reference=link=>!['CONTRADICTS','SUPERSEDES','LEADS_TO','CONTRIBUTED_BY'].includes(link.relationType);

export function evidenceNeighbors(project,id) {
  const records=new Map((project.records||[]).map(record=>[record.id,record]));
  return (project.links||[]).filter(link=>accepted(link)&&(link.from===id||link.to===id))
    .map(link=>({link,record:records.get(link.from===id?link.to:link.from)})).filter(item=>item.record);
}

function hasVersion(project,record) {
  if(present(record.revision))return true;
  const iterationId=record.iterationId||record.nativeRef?.iterationId;
  if(iterationId&&(project.records||[]).some(item=>item.id===iterationId&&item.kind==='iteration'))return true;
  return evidenceNeighbors(project,record.id).some(({link,record:other})=>reference(link)&&
    (other.kind==='iteration'||(other.kind==='source'&&present(other.revision))));
}

function testGaps(project,record) {
  const missing=[];
  if(!hasVersion(project,record))missing.push('version');
  if(!present(record.conditions))missing.push('conditions');
  if(!present(record.criterion))missing.push('criterion');
  const counts=Number.isInteger(record.trials)&&record.trials>0&&Number.isInteger(record.successes)&&record.successes>=0&&record.successes<=record.trials;
  if(!counts&&!Number.isFinite(record.measuredValue)&&!present(record.body))missing.push('result');
  return missing;
}

/** A documentation checklist, never a scientific validity or causality score.
 * Missing context stays visible for closed legacy records; no record is mutated. */
export function assessEvidence(project,record) {
  if(!['decision','test','iteration'].includes(record.kind))return {applicable:false,complete:false,gaps:[],supporting:[]};
  const supporting=evidenceNeighbors(project,record.id).filter(({link,record:other})=>reference(link)&&['source','test'].includes(other.kind));
  const gaps=[];
  const add=(key,target=record)=>{if(!gaps.some(gap=>gap.key===key&&gap.record.id===target.id))gaps.push({key,record:target});};
  if(record.kind==='test')for(const key of testGaps(project,record))add(key);
  else {
    if(!present(record.rationale))add('why');
    if(!supporting.length)add('support');
    if(record.kind==='decision'&&!hasVersion(project,record)&&!supporting.some(({record:other})=>hasVersion(project,other)))add('version');
    if(record.kind==='iteration') {
      if(!present(record.body))add('change');
      if(!present(record.revision))add('revision');
      if(!['kept','reverted','iterate','deferred','rejected'].includes(record.outcome))add('outcome');
      if(['pass','fail','partial'].includes(record.testOutcome)&&!supporting.some(({record:other})=>other.kind==='test'))add('testRecord');
    }
    for(const {record:other} of supporting)if(other.kind==='test')for(const key of testGaps(project,other))add(key,other);
  }
  return {applicable:true,complete:gaps.length===0,gaps,supporting};
}

export function evidenceSummary(project,record) {
  const assessment=assessEvidence(project,record);
  if(!assessment.applicable)return '';
  return assessment.complete?t('evidence.complete'):t('evidence.missing',{items:[...new Set(assessment.gaps.map(gap=>t('evidence.'+gap.key)))].join('; ')});
}

/** Uses existing workspace styles; each issue opens its exact authored record. */
export function appendEvidenceAssessment(container,project,record,{onOpen,onEdit}={}) {
  const assessment=assessEvidence(project,record);if(!assessment.applicable)return;
  const section=document.createElement('section');section.className='ws-evidence-note ws-completeness';
  const heading=document.createElement('strong');heading.textContent=t('evidence.heading');section.append(heading);
  const note=document.createElement('p');note.textContent=t('evidence.scope');section.append(note);
  if(assessment.complete){const text=document.createElement('p');text.textContent=t('evidence.complete');section.append(text);}
  else {
    const list=document.createElement('ul');
    for(const gap of assessment.gaps) {
      const item=document.createElement('li'),action=gap.record.id===record.id?onEdit:onOpen;
      const label=t('evidence.'+gap.key)+(gap.record.id!==record.id?' — '+gap.record.title:'');
      const content=document.createElement(action?'button':'span');content.textContent=label;
      if(action){content.type='button';content.className='ws-text-action';content.addEventListener('click',()=>action(gap.record.id,gap.key));}
      item.append(content);list.append(item);
    }
    section.append(list);
  }
  container.append(section);return section;
}

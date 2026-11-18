/** Authored evidence only; suggestions never become a confirmed explanation. */
export function iterationEvidence(project,iterationId) {
  const byId=new Map((project.records||[]).map(item=>[item.id,item]));
  const seen=new Set();
  return (project.links||[]).filter(link=>link.status==='accepted'&&(link.from===iterationId||link.to===iterationId))
    .map(link=>({link,record:byId.get(link.from===iterationId?link.to:link.from)}))
    .filter(item=>item.record&&!seen.has(item.record.id)&&seen.add(item.record.id));
}
export function iterationMissing(record) {
  const missing=[];
  if(!record.body?.trim())missing.push('change');
  if(!record.rationale?.trim())missing.push('why');
  if(!['kept','reverted','iterate','deferred','rejected'].includes(record.outcome))missing.push('outcome');
  return missing;
}
export function recordIterationIds(record,project) {
  if(record.kind==='iteration')return [record.id];
  const ids=new Set((project.records||[]).filter(item=>item.kind==='iteration').map(item=>item.id));
  const found=new Set();
  const native=record.iterationId||record.nativeRef?.iterationId;
  if(native&&ids.has(native))found.add(native);
  for(const link of project.links||[])if(link.status==='accepted') {
    if(link.from===record.id&&ids.has(link.to))found.add(link.to);
    if(link.to===record.id&&ids.has(link.from))found.add(link.from);
  }
  return [...found];
}
export function filterIterations(project,{query='',subsystem='',state='all'}={}) {
  const needle=query.trim().toLocaleLowerCase();
  return (project.records||[]).filter(record=>record.kind==='iteration'&&(!subsystem||record.subsystem===subsystem)&&
    (state==='all'||record.status===state)&&(!needle||[record.title,record.body,record.rationale,record.problemOrGoal,record.subsystem].some(value=>String(value||'').toLocaleLowerCase().includes(needle))))
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id));
}

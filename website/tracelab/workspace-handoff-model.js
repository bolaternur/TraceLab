export function handoffSections(project) {
  const sections={decisions:[],failed:[],open:[],tests:[],advice:[],materials:[]};
  const records=[...(project.records||[])].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.id.localeCompare(b.id));
  for(const record of records) {
    if(record.kind==='source'&&record.sourceType==='handoff')sections.advice.push(record);
    else if(record.kind==='iteration'&&(['reverted','rejected'].includes(record.outcome)||record.testOutcome==='fail'))sections.failed.push(record);
    else if(['iteration','decision'].includes(record.kind)&&record.status!=='closed')sections.open.push(record);
    else if(record.kind==='decision')sections.decisions.push(record);
    else if(record.kind==='test')sections.tests.push(record);
    else if(record.kind==='source')sections.materials.push(record);
    else if(record.kind==='iteration')sections.decisions.push(record);
  }
  return Object.entries(sections).map(([key,records])=>({key,records}));
}

/** A user can include exact accepted sources/tests with selected entries.
 * No suggestions, rejected edges or transitive inferred conclusions are added. */
export function handoffSelection(project,selected,{includeEvidence=false}={}) {
  const selectedIds=new Set(selected),byId=new Map((project.records||[]).map(item=>[item.id,item]));
  const valid=new Set([...selectedIds].filter(id=>byId.has(id)));
  if(includeEvidence)for(const link of project.links||[])if(link.status==='accepted') {
    const other=selectedIds.has(link.from)?link.to:selectedIds.has(link.to)?link.from:null;
    if(other&&['source','test'].includes(byId.get(other)?.kind))valid.add(other);
  }
  return (project.records||[]).filter(item=>valid.has(item.id)).map(item=>item.id);
}

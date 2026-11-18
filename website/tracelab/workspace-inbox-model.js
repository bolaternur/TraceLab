/** These are review proposals, not engineering relations or inferred intent. */
export function proposeInboxGroups(items,{windowMs=30*60*1000}={}) {
  const buckets=new Map();
  const ordered=items.filter(item=>item.status==='inbox'&&Number.isFinite(Date.parse(item.occurredAt)))
    .slice().sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)||String(a.sourceId).localeCompare(String(b.sourceId)));
  for(const item of ordered) {
    const key=JSON.stringify([item.provider||'',item.metadata?.repository||'',item.subsystemName||'']);
    if(!buckets.has(key))buckets.set(key,[]);
    const clusters=buckets.get(key),last=clusters.at(-1),at=Date.parse(item.occurredAt);
    if(last&&at-last.from<=windowMs){last.sourceIds.push(item.sourceId);last.to=at;}
    else clusters.push({provider:item.provider||'',repository:item.metadata?.repository||'',subsystem:item.subsystemName||'',from:at,to:at,sourceIds:[item.sourceId]});
  }
  return [...buckets.values()].flat().filter(group=>group.sourceIds.length>=2)
    .sort((a,b)=>b.to-a.to||a.provider.localeCompare(b.provider));
}

/** Each write has its own server receipt. One failed source cannot cancel or
 * duplicate another source's completed write. `run` owns authorization/revision. */
export async function runInboxBatch(sourceIds,{run,onProgress=()=>{},stopped=()=>false}={}) {
  const saved=[],failed=[];
  for(const sourceId of [...new Set(sourceIds)]) {
    if(stopped())break;
    try{await run(sourceId);saved.push(sourceId);onProgress({sourceId,saved:true});}
    catch(error){failed.push({sourceId,error});onProgress({sourceId,saved:false,error});}
  }
  return {saved,failed};
}

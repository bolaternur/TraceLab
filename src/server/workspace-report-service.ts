import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool } from "@/db";
import type { WorkspaceProject } from "../../website/tracelab/workspace-store.js";
import { workspaceTransaction, WorkspaceError, type WorkspaceUser } from "./workspace-service";
import { mediaStorage } from "./workspace-media-storage";
import type { StorageAdapter } from "./storage";
import { decisionEvidenceIds, evaluateReportPolicy, publicManifest, recordWarnings, REPORT_LIMITS, reportHash, reportInput, type RecordRef, type ReportData, type ReportMedia, type ReportOptions, type ReportPolicy } from "./workspace-report-model";
import { renderReportHtml, renderReportPdf, type ReportImage } from "./workspace-report-render";

const uuid=z.string().uuid();
const denied=()=>new WorkspaceError("forbidden",403,"Нет доступа к этому проекту или отчёту.");
type ProjectRow={id:string;team_id:string;season_id:string;name:string;description:string|null;team_name:string;program:string;season_name:string;role:string;revision:number;educational_origin:boolean;body:string|null;snapshot_id:string|null;competition_profile_id:string|null};
async function projectRow(client:PoolClient,user:WorkspaceUser,id:string){
  const row=(await client.query<ProjectRow>(`SELECT p.*,t.name AS team_name,t.program,t.competition_profile_id,s.name AS season_name,m.role,
    COALESCE(w.revision,0) AS revision,COALESCE(w.educational_origin,false) AS educational_origin,a.body,a.id AS snapshot_id
    FROM projects p JOIN teams t ON t.id=p.team_id JOIN seasons s ON s.id=p.season_id
    JOIN team_memberships m ON m.team_id=p.team_id AND m.user_id=$2 AND m.status='active'
    LEFT JOIN workspace_project_state w ON w.project_id=p.id LEFT JOIN LATERAL
    (SELECT body,id FROM annotations WHERE entity_type='project' AND entity_id=p.id AND field='workspace_snapshot' ORDER BY created_at DESC,id DESC LIMIT 1) a ON true
    WHERE p.id=$1`,[uuid.parse(id),user.id])).rows[0];
  if(!row)throw denied();return row;
}
async function loadPolicy(client:PoolClient,row:ProjectRow):Promise<ReportPolicy|null>{
  if(!row.competition_profile_id)return null;
  const p=(await client.query(`SELECT v.*,c.program FROM policy_versions v JOIN competition_profiles c ON c.id=v.profile_id
    WHERE v.profile_id=$1 ORDER BY (v.status='active') DESC,v.created_at DESC LIMIT 1`,[row.competition_profile_id])).rows[0];
  if(!p)return null;
  return {id:p.id,profileId:p.profile_id,program:p.program,season:String(p.constraints?.season??""),version:p.version,status:p.status,
    reviewedAt:p.reviewed_at?.toISOString()??null,reviewer:p.reviewer,effectiveFrom:p.effective_from?.toISOString()??null,
    sourceUrls:Array.isArray(p.source_urls)?p.source_urls:[],constraints:p.constraints??{},matrix:p.action_matrix??{}};
}
async function capture(client:PoolClient,user:WorkspaceUser,options:ReportOptions):Promise<ReportData>{
  const row=await projectRow(client,user,options.projectId);
  const project:WorkspaceProject=row.body?JSON.parse(row.body):{id:row.id,name:row.name,description:row.description??"",dataKind:"personal",records:[],links:[],studyRows:[]};
  project.id=row.id;project.name=row.name;project.educationalOrigin=Boolean(row.educational_origin||project.educationalOrigin||project.dataKind==="synthetic");
  delete project.nodePositions;
  const refs=(await client.query<RecordRef>(`SELECT m.local_id AS "localId",m.entity_id AS "canonicalId",m.entity_type AS "entityType",
    m.author_user_id AS "authorUserId",m.imported_by AS "importedBy",m.original_author_label AS "originalAuthorLabel",e.content_hash AS "sourceHash",
    e.raw_metadata AS "sourceOriginal",a.id AS "annotationId",a.body AS annotation_body,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',n.id,'authorUserId',n.author_user_id,'sourceMethod',n.source_method,'provenance',n.provenance,
      'supersedesId',n.supersedes_id,'createdAt',n.created_at,'body',n.body) ORDER BY n.created_at,n.id) FROM annotations n
      WHERE n.entity_id=m.entity_id AND n.field='workspace_record'),'[]'::jsonb) AS "annotationHistory"
    FROM workspace_entity_map m JOIN source_events e ON e.id=m.entity_id AND e.team_id=m.team_id
    LEFT JOIN LATERAL (SELECT id,body FROM annotations WHERE entity_id=m.entity_id AND field='workspace_record' ORDER BY created_at DESC,id DESC LIMIT 1) a ON true
    WHERE m.project_id=$1 AND m.entity_type!='relation'`,[row.id])).rows.map(ref=>{
      const body=(ref as RecordRef&{annotation_body:string|null}).annotation_body;delete (ref as Partial<RecordRef&{annotation_body:string|null}>).annotation_body;
      return {...ref,annotationHash:body?reportHash(body):null};
    });
  const available=project.records.length,requested=options.recordIds?new Set(options.recordIds):null;
  if(requested&&[...requested].some(id=>!project.records.some(r=>r.id===id)))throw new WorkspaceError("record_not_found",422,"Выбранная запись отсутствует в проекте.");
  project.records=project.records.filter(record=>(!requested||requested.has(record.id))&&(options.scope!=="personal"||refs.some(ref=>ref.localId===record.id&&ref.authorUserId===user.id)));
  if(!project.records.length)throw new WorkspaceError("empty_report",422,"Для отчёта нужна хотя бы одна доступная запись.");
  if(project.records.length>REPORT_LIMITS.records)throw new WorkspaceError("selection_limit",422,"Выберите не более 500 записей; остальные материалы останутся в проекте.");
  const selectedIds=new Set(project.records.map(r=>r.id)),selectedRefs=refs.filter(ref=>selectedIds.has(ref.localId));
  project.links=project.links.filter(link=>selectedIds.has(link.from)&&selectedIds.has(link.to));
  if(options.scope==="personal"){
    project.studyRows=[];delete project.annotationHistory;delete project.importManifest;delete project.importWarnings;
  }
  const media=(await client.query<{id:string;recordId:string;mimeType:string;bytes:number;sha256:string|null;storageKey:string|null;metadata:Record<string,unknown>;modelId:string|null;versionLabel:string|null;annotationId:string|null;edited:string|null}>(`SELECT a.id,m.local_id AS "recordId",a.mime_type AS "mimeType",a.size_bytes AS bytes,a.sha256,a.storage_key AS "storageKey",a.metadata,
    r.id AS "modelId",r.version_label AS "versionLabel",n.id AS "annotationId",n.body AS edited
    FROM artifacts a JOIN workspace_entity_map m ON m.entity_id=a.source_event_id AND m.team_id=a.team_id
    LEFT JOIN robot_models r ON r.artifact_id=a.id
    LEFT JOIN LATERAL (SELECT id,body FROM annotations WHERE entity_type='artifact' AND entity_id=a.id AND field='media_metadata' ORDER BY created_at DESC,id DESC LIMIT 1) n ON true
    WHERE m.project_id=$1 AND m.local_id=ANY($2::text[])`,[row.id,[...selectedIds]])).rows.map(item=>{
      const edited=item.edited?JSON.parse(item.edited):{};
      return {id:item.id,recordId:item.recordId,mimeType:item.mimeType,bytes:item.bytes,sha256:item.sha256,storageKey:item.storageKey,
        caption:String(edited.caption??item.metadata.caption??""),alt:String(edited.alt??item.metadata.alt??""),modelId:item.modelId,versionLabel:item.versionLabel,annotationId:item.annotationId} satisfies ReportMedia;
    });
  const policy=await loadPolicy(client,row),policyGate=evaluateReportPolicy(policy,row.program,row.season_name,options.purpose);
  const warnings=recordWarnings(project.records,project,selectedRefs);
  for(const mediaItem of media)if(!["image/png","image/jpeg"].includes(mediaItem.mimeType))warnings.push({code:"media_reference_only",artifactId:mediaItem.id});
  if(options.purpose==="engineering")warnings.push({code:"engineering_not_competition_approval"});
  return {schemaVersion:1,exportId:randomUUID(),version:0,createdAt:new Date().toISOString(),creator:{id:user.id,displayName:user.displayName},
    team:{id:row.team_id,name:row.team_name,program:row.program},season:{id:row.season_id,name:row.season_name},project,
    projectSnapshotId:row.snapshot_id,projectRevision:row.revision,options,refs:selectedRefs,media,policyGate,warnings,
    completeness:{selected:project.records.length,available,complete:project.records.length===available},
    contentHash:reportHash(JSON.stringify({project,refs:selectedRefs,media:media.map(({storageKey:_key,...item})=>item),policyGate}))};
}
export async function previewWorkspaceReport(user:WorkspaceUser,projectId:string){
  return workspaceTransaction(user,async client=>{
    const row=await projectRow(client,user,projectId),policy=await loadPolicy(client,row);
    const project:WorkspaceProject=row.body?JSON.parse(row.body):{id:row.id,name:row.name,description:row.description??"",dataKind:"personal",records:[],links:[],studyRows:[]};
    const data=project.records.length?await capture(client,user,reportInput.parse({projectId,requestId:randomUUID()})):null;
    const exports=(await client.query(`SELECT e.id,e.version,e.created_at AS "createdAt",e.status,e.manifest,j.state,j.error_code AS "errorCode",j.attempt,
      j.user_id AS "creatorId",j.request_id AS "requestId",j.input->'options' AS options
      FROM exports e JOIN workspace_export_jobs j ON j.export_id=e.id WHERE j.project_id=$1 ORDER BY e.created_at DESC`,[projectId])).rows
      .map(item=>({...item,downloadUrl:item.status==="ready"?"/api/workspace/report?download="+item.id:null}));
    return {project:{id:row.id,name:row.name,teamId:row.team_id,season:row.season_name,revision:row.revision},
      records:project.records.map(record=>({id:record.id,title:record.title,kind:record.kind,author:record.author,
        authoredByMe:Boolean(data?.refs.some(ref=>ref.localId===record.id&&ref.authorUserId===user.id)),
        evidenceIds:record.kind==="decision"?decisionEvidenceIds(record.id,project.records,project.links):[]})),warnings:data?.warnings??[],
      policyGate:evaluateReportPolicy(policy,row.program,row.season_name,"competition"),completeness:{available:project.records.length,complete:true},limits:REPORT_LIMITS,exports};
  });
}
type Job={export_id:string;team_id:string;project_id:string;user_id:string;request_id:string;payload_hash:string;storage_key:string;cleanup_keys:string[];input:ReportData;state:string;attempt:number;lease_until:Date|null};
type ExportResult={exportId:string;downloadUrl:string;manifest:ReturnType<typeof publicManifest>&{output:{sha256:string;bytes:number;pages:number|null;mimeType:string}};warnings:ReportData["warnings"];replayed?:boolean};
async function savedResult(client:PoolClient,id:string):Promise<ExportResult>{
  const row=(await client.query<{manifest:ExportResult["manifest"]}>("SELECT manifest FROM exports WHERE id=$1 AND status='ready'",[id])).rows[0];
  if(!row)throw new WorkspaceError("report_not_ready",409,"Отчёт ещё не готов.");
  return {exportId:id,downloadUrl:"/api/workspace/report?download="+id,manifest:row.manifest,warnings:row.manifest.warnings};
}
export async function createWorkspaceReport(user:WorkspaceUser,raw:unknown,hooks:{storage?:StorageAdapter;afterStorage?:()=>void|Promise<void>}={}):Promise<ExportResult>{
  const options=reportInput.parse(raw),storage=hooks.storage??mediaStorage,payloadHash=reportHash(JSON.stringify(options));
  const rate=(await pool.query<{attempts:number}>(`INSERT INTO account_rate_limits(key_hash,window_started_at,attempts) VALUES($1,now(),1)
    ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN account_rate_limits.window_started_at<now()-interval '10 minutes' THEN 1 ELSE account_rate_limits.attempts+1 END,
    window_started_at=CASE WHEN account_rate_limits.window_started_at<now()-interval '10 minutes' THEN now() ELSE account_rate_limits.window_started_at END RETURNING attempts`,[reportHash("report:"+user.id)])).rows[0];
  if(rate.attempts>20)throw new WorkspaceError("rate_limited",429,"Слишком много отчётов. Повторите через несколько минут.");
  const claim=await workspaceTransaction(user,async client=>{
    const row=await projectRow(client,user,options.projectId);if(!["student","student_lead"].includes(row.role))throw denied();
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["report:"+user.id+":"+options.requestId]);
    let job=(await client.query<Job>("SELECT * FROM workspace_export_jobs WHERE user_id=$1 AND request_id=$2 FOR UPDATE",[user.id,options.requestId])).rows[0];
    if(job){
      if(job.payload_hash!==payloadHash)throw new WorkspaceError("idempotency_conflict",409,"Этот запрос уже использован с другим содержимым.");
      if(job.state==="ready")return {result:{...await savedResult(client,job.export_id),replayed:true}};
      if(job.state==="cancelled")throw new WorkspaceError("report_cancelled",409,"Создание отчёта отменено. Для нового отчёта создайте новый запрос.");
      if(job.state==="rendering"&&job.lease_until&&job.lease_until>new Date())throw new WorkspaceError("report_in_progress",409,"Отчёт уже формируется.");
      // Retrying uses the captured snapshot and a fresh object key, never overwriting a previous attempt.
      const gate=evaluateReportPolicy(job.input.policyGate.policy,job.input.team.program,job.input.season.name,job.input.options.purpose);
      if(!gate.allowed)throw new WorkspaceError("policy_review_required",422,"Нужна актуальная проверенная версия правил соревнования.");
      const key=`${job.team_id}/exports/${randomUUID()}.${options.format}`;
      job=(await client.query<Job>(`UPDATE workspace_export_jobs SET state='rendering',attempt=attempt+1,lease_until=now()+interval '10 minutes',updated_at=now(),
        cleanup_keys=cleanup_keys||jsonb_build_array(storage_key),storage_key=$2,error_code=NULL WHERE export_id=$1 RETURNING *`,[job.export_id,key])).rows[0];
    }else{
      const data=await capture(client,user,options);
      if(!data.policyGate.allowed)throw new WorkspaceError("policy_review_required",422,"Нужна актуальная проверенная версия правил соревнования.");
      if(data.warnings.length&&!options.acknowledgeWarnings)throw new WorkspaceError("warnings_require_review",422,"Просмотрите предупреждения и подтвердите проверку перед созданием отчёта.");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["report-version:"+row.id]);
      data.version=Number((await client.query<{version:number}>(`SELECT COALESCE(max(e.version),0)+1 AS version FROM exports e JOIN workspace_export_jobs j ON j.export_id=e.id WHERE j.project_id=$1`,[row.id])).rows[0].version);
      const key=`${row.team_id}/exports/${data.exportId}.${options.format}`;
      await client.query(`INSERT INTO exports(id,team_id,type,version,created_by,policy_version_id,policy_decision,config,manifest,status)
        VALUES($1,$2,'engineering_report',$3,$4,$5,$6,$7,$8,'queued')`,[data.exportId,row.team_id,data.version,user.id,data.policyGate.policy?.id??null,data.policyGate.decision,JSON.stringify(options),JSON.stringify(publicManifest(data))]);
      job=(await client.query<Job>(`INSERT INTO workspace_export_jobs(export_id,project_id,team_id,user_id,request_id,payload_hash,storage_key,input,state,attempt,lease_until)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'rendering',1,now()+interval '10 minutes') RETURNING *`,[data.exportId,row.id,row.team_id,user.id,options.requestId,payloadHash,key,JSON.stringify(data)])).rows[0];
    }
    return {job};
  });
  if(claim.result)return claim.result;
  const job=claim.job!,data=job.input;
  let written=false;
  try{
    // Each retry has a new object key. Cleanup is exact-key only and can be
    // repeated after a crash; a previous worker cannot finalize this attempt.
    for(const key of job.cleanup_keys){
      await storage.delete(key);
      await workspaceTransaction(user,client=>client.query("UPDATE workspace_export_jobs SET cleanup_keys=cleanup_keys-$2::text WHERE export_id=$1 AND attempt=$3",[job.export_id,key,job.attempt]));
    }
    const images:ReportImage[]=[];let imageBytes=0;
    for(const item of data.media){
      if(!["image/png","image/jpeg"].includes(item.mimeType))continue;
      if(!item.storageKey||item.bytes>REPORT_LIMITS.imageBytes||imageBytes+item.bytes>REPORT_LIMITS.totalImageBytes){data.warnings.push({code:"image_not_embedded",artifactId:item.id});continue;}
      const bytes=await storage.get(item.storageKey);
      if(!bytes||bytes.length!==item.bytes||(item.sha256&&reportHash(bytes)!==item.sha256)){data.warnings.push({code:"missing_or_changed_asset",artifactId:item.id});continue;}
      images.push({id:item.id,bytes,mimeType:item.mimeType as ReportImage["mimeType"]});imageBytes+=bytes.length;
    }
    let bytes:Buffer,pages:number|null=null;
    if(options.format==="pdf"){const result=await renderReportPdf(data,images);bytes=result.bytes;pages=result.pages;}
    else if(options.format==="html")bytes=Buffer.from(await renderReportHtml(data,images));
    else bytes=Buffer.from(JSON.stringify({schemaVersion:1,project:data.project,manifest:publicManifest(data)},null,2));
    const policy=data.policyGate.policy,policyMaxBytes=options.purpose==="competition"?Number(policy?.constraints.maxFileMb)*1024*1024:Infinity;
    if(bytes.length>Math.min(REPORT_LIMITS.bytes,policyMaxBytes)||(pages!==null&&pages>Math.min(REPORT_LIMITS.pages,options.purpose==="competition"?Number(policy?.constraints.maxPages):Infinity)))throw new WorkspaceError("report_limit_exceeded",422,"Размер или число страниц превышает проверенное ограничение. Уменьшите выбор материалов.");
    if(options.purpose==="competition"&&data.warnings.some(warning=>["missing_or_changed_asset","image_not_embedded","media_reference_only","missing_why","missing_evidence"].includes(warning.code)))throw new WorkspaceError("report_preflight_blocked",422,"Нужны недостающие доказательства или файлы перед экспортом для соревнования.");
    const mimeType={pdf:"application/pdf",html:"text/html; charset=utf-8",json:"application/json; charset=utf-8"}[options.format];
    const manifest={...publicManifest(data),output:{sha256:reportHash(bytes),bytes:bytes.length,pages,mimeType}};
    await storage.put(job.storage_key,bytes,mimeType);written=true;await hooks.afterStorage?.();
    return await workspaceTransaction(user,async client=>{
      const row=await projectRow(client,user,job.project_id);if(!["student","student_lead"].includes(row.role))throw denied();
      const current=(await client.query<Job>("SELECT * FROM workspace_export_jobs WHERE export_id=$1 FOR UPDATE",[job.export_id])).rows[0];
      if(!current||current.state!=="rendering"||current.attempt!==job.attempt)throw new WorkspaceError("report_cancelled",409,"Этот запуск отчёта отменён или заменён.");
      await client.query("UPDATE exports SET status='ready',storage_key=$2,hash=$3,manifest=$4,error=NULL WHERE id=$1",[job.export_id,job.storage_key,manifest.output.sha256,JSON.stringify(manifest)]);
      await client.query("UPDATE workspace_export_jobs SET state='ready',lease_until=NULL,updated_at=now() WHERE export_id=$1",[job.export_id]);
      await client.query("INSERT INTO audit_events(team_id,actor_user_id,action,entity_type,entity_id) VALUES($1,$2,'export.created','export',$3)",[job.team_id,user.id,job.export_id]);
      return {exportId:job.export_id,downloadUrl:"/api/workspace/report?download="+job.export_id,manifest,warnings:data.warnings};
    });
  }catch(error){
    let cleanupFailed=false;
    if(written)try{await storage.delete(job.storage_key);}catch{cleanupFailed=true;}
    const code=error instanceof WorkspaceError?error.code:"report_generation_failed";
    // The durable intent survives loss of membership; an operator can recover that exact key.
    await workspaceTransaction(user,async client=>{
      await client.query(`UPDATE workspace_export_jobs SET state=$3,error_code=$4,lease_until=NULL,updated_at=now()
        WHERE export_id=$1 AND attempt=$2 AND state='rendering'`,[job.export_id,job.attempt,cleanupFailed?"cleanup_pending":"failed",code]);
      await client.query("UPDATE exports SET status='failed',error=$2 WHERE id=$1 AND status='queued'",[job.export_id,code]);
    }).catch(()=>{});
    if(error instanceof WorkspaceError)throw error;
    throw new WorkspaceError("report_generation_failed",503,"Не удалось создать отчёт. Исходные записи сохранены; повторите запрос позже.");
  }
}
export async function downloadWorkspaceReport(user:WorkspaceUser,id:string,storage:StorageAdapter=mediaStorage){
  const row=await workspaceTransaction(user,async client=>{
    const value=(await client.query<{id:string;storage_key:string;hash:string;manifest:ExportResult["manifest"];project_id:string}>(`SELECT e.*,j.project_id FROM exports e JOIN workspace_export_jobs j ON j.export_id=e.id WHERE e.id=$1 AND e.status='ready'`,[uuid.parse(id)])).rows[0];
    if(!value)throw denied();await projectRow(client,user,value.project_id);return value;
  });
  const bytes=await storage.get(row.storage_key);
  if(!bytes||reportHash(bytes)!==row.hash)throw new WorkspaceError("report_file_unavailable",503,"Файл недоступен или его целостность нарушена.");
  // Membership may be revoked while storage is being read.
  await workspaceTransaction(user,client=>projectRow(client,user,row.project_id));
  return {bytes,mimeType:row.manifest.output.mimeType,filename:`tracelab-${row.id}.${row.manifest.format}`,manifest:row.manifest};
}

export async function cancelWorkspaceReport(user:WorkspaceUser,id:string){
  return workspaceTransaction(user,async client=>{
    const job=(await client.query<Job>("SELECT * FROM workspace_export_jobs WHERE export_id=$1 FOR UPDATE",[uuid.parse(id)])).rows[0];
    if(!job||job.user_id!==user.id)throw denied();
    if(job.state==="ready")throw new WorkspaceError("report_finished",409,"Готовый отчёт не изменяется.");
    await client.query("UPDATE workspace_export_jobs SET state='cancelled',lease_until=NULL,updated_at=now() WHERE export_id=$1",[id]);
    await client.query("UPDATE exports SET status='failed',error='cancelled' WHERE id=$1 AND status!='ready'",[id]);return {exportId:id,state:"cancelled"};
  });
}

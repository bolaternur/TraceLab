import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool } from "@/db";
import {decryptSecret,encryptSecret} from "./storage";
import {inviteCreation,newTeamInviteCode,parseInviteToken} from "./workspace-invite-contract";
import { createWorkspaceStore, type WorkspaceProject, type WorkspaceRecord, type WorkspaceLink } from "../../website/tracelab/workspace-store.js";

export type WorkspaceUser = { id: string; displayName: string; locale: string };
export class WorkspaceError extends Error {
  constructor(public code: string, public status: number, message: string, public details?: {draftId:string}) { super(message); this.name = "WorkspaceError"; }
}
const denied = () => new WorkspaceError("forbidden", 403, "Нет доступа к этой команде или записи.");
const invalid = (message: string) => new WorkspaceError("invalid_fields", 422, message);
const uuid = z.string().uuid();
export const workspaceCommand = z.object({
  command: z.enum(["createTeam","createInvite","joinInvite","selectTeam","createProject","addRecord","updateRecord","addLink","removeLink","setNodePosition","resetNodePositions","addStudyRow","addStudyRows","previewImport","importProject","triageSource"]),
  projectId: uuid.optional(), teamId: uuid.optional(), expectedRevision: z.number().int().nonnegative().optional(),
  requestId: uuid, args: z.array(z.unknown()).max(3).default([]),
}).strict();
type Command = z.infer<typeof workspaceCommand>;
type TeamRow = { id: string; name: string; timezone: string; role: string };
type ProjectRow = { id: string; team_id: string; season_id: string; name: string; description: string | null; revision: number; node_positions: WorkspaceProject["nodePositions"]; educational_origin: boolean; snapshot: string | null };
type EntityRow = { local_id: string; entity_id: string; entity_type: string; author_user_id: string | null; imported_by: string | null };
type Receipt = { teamId: string | null; projectId: string | null; result: unknown };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function stable(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,v]) => JSON.stringify(key)+":"+stable(v)).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
function fields(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid("Нужен объект с полями.");
  return value as Record<string, unknown>;
}
function student(role: string) { if (!["student","student_lead"].includes(role)) throw denied(); }
const projectSql = `SELECT p.*, COALESCE(s.revision,0) AS revision, COALESCE(s.node_positions,'{}'::jsonb) AS node_positions,
 COALESCE(s.educational_origin,false) AS educational_origin,
 (SELECT a.body FROM annotations a WHERE a.entity_type='project' AND a.entity_id=p.id AND a.field='workspace_snapshot'
  ORDER BY a.created_at DESC,a.id DESC LIMIT 1) AS snapshot
 FROM projects p LEFT JOIN workspace_project_state s ON s.project_id=p.id`;

export async function workspaceTransaction<T>(user: WorkspaceUser, callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id',$1,true)", [uuid.parse(user.id)]);
    const verified = await client.query("SELECT 1 FROM account_verification WHERE user_id=$1 AND verified_at IS NOT NULL", [user.id]);
    if (!verified.rowCount) throw new WorkspaceError("verification_required", 403, "Сначала подтвердите адрес электронной почты.");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
async function memberships(client: PoolClient, userId: string) {
  return (await client.query<TeamRow>(`SELECT t.id,t.name,t.timezone,m.role FROM teams t JOIN team_memberships m ON m.team_id=t.id
    WHERE m.user_id=$1 AND m.status='active' ORDER BY t.created_at,t.id`, [userId])).rows;
}
function projectView(row: ProjectRow): WorkspaceProject {
  const project: WorkspaceProject = row.snapshot ? JSON.parse(row.snapshot) : {
    id: row.id, name: row.name, description: row.description ?? "", dataKind: "personal", records: [], links: [], studyRows: [],
  };
  const view:WorkspaceProject = { ...project, id: row.id, name: row.name, description: row.description ?? "", dataKind: "personal",
    educationalOrigin: row.educational_origin || project.educationalOrigin || project.dataKind === "synthetic",
    nodePositions: row.node_positions ?? {}, serverRevision: row.revision };
  // Apply backward-compatible defaults equally to both sides of a mutation.
  // Otherwise adding iteration lifecycle fields to legacy snapshots would look
  // like unsolicited edits of every other author's existing iteration.
  return {...validator(view).getProject(),serverRevision:row.revision};
}
async function bootstrap(client: PoolClient, user: WorkspaceUser, wantedTeam?: string | null, wantedProject?: string | null) {
  const teams = await memberships(client, user.id);
  if (!teams.length) {
    if (wantedTeam || wantedProject) throw denied();
    return { user, needsOnboarding: true, team: null, teams: [], role: null, projects: [], activeProjectId: null, completeness: { projects: 0, complete: true } };
  }
  const team = wantedTeam ? teams.find(item => item.id === wantedTeam) : teams[0];
  if (!team) throw denied();
  const rows = (await client.query<ProjectRow>(projectSql + " WHERE p.team_id=$1 ORDER BY p.created_at,p.id", [team.id])).rows;
  if (wantedProject && !rows.some(project => project.id === wantedProject)) throw denied();
  const projects = rows.map(projectView);
  const editableRows=await client.query<{project_id:string;local_id:string}>(`SELECT project_id,local_id FROM workspace_entity_map WHERE team_id=$1 AND (author_user_id=$2 OR imported_by=$2)`,[team.id,user.id]);
  const editableRecordIds=Object.fromEntries(projects.map(project=>[project.id,editableRows.rows.filter(item=>item.project_id===project.id).map(item=>item.local_id)]));
  const conflictDrafts=(await client.query<{id:string;project_id:string;local_id:string;body:string;created_at:Date}>(`SELECT a.id,m.project_id,m.local_id,a.body,a.created_at FROM annotations a JOIN workspace_entity_map m ON m.entity_id=a.entity_id AND m.team_id=a.team_id WHERE a.team_id=$1 AND a.author_user_id=$2 AND a.field='workspace_conflict' ORDER BY a.created_at DESC,a.id DESC LIMIT 100`,[team.id,user.id])).rows.map(item=>({id:item.id,projectId:item.project_id,recordId:item.local_id,createdAt:item.created_at.toISOString(),...JSON.parse(item.body)}));
  return { user, team: { id: team.id, name: team.name, timezone: team.timezone }, teams, role: team.role, projects,
    activeProjectId: wantedProject || projects[0]?.id || null, needsOnboarding: false,
    completeness: { projects: projects.length, complete: true },editableRecordIds,conflictDrafts,
    limits: { projects: 20, recordsPerProject: 500, linksPerProject: 1000, projectJsonBytes: 2097152 } };
}
export async function getWorkspace(user: WorkspaceUser, options: {team?: string | null;project?: string | null} = {}) {
  if (options.team) uuid.parse(options.team);
  if (options.project) uuid.parse(options.project);
  return workspaceTransaction(user, async client => {
    let team=options.team;
    if(options.project && !team) {
      const row=(await client.query<{team_id:string}>("SELECT team_id FROM projects WHERE id=$1",[options.project])).rows[0];
      if(!row)throw denied();
      team=row.team_id;
    }
    return bootstrap(client,user,team,options.project);
  });
}
function validator(project?: WorkspaceProject) {
  // Private isolated memory, never a browser origin or a persistent server file.
  let raw = project ? JSON.stringify({ schemaVersion: 1, activeProjectId: project.id, projects: [{...project, dataKind:"personal"}] }) : null;
  const store = createWorkspaceStore({ storage: { getItem: () => raw, setItem: (_key, value) => {raw=value;} }, eventTarget: null, idFactory: () => randomUUID() });
  if (project && store.getProject().id !== project.id) throw new WorkspaceError("invalid_saved_project",500,"Сохранённый проект не удалось проверить; исходные данные не изменены.");
  return store;
}
async function currentProject(client: PoolClient, projectId: string, teamId: string) {
  const row = (await client.query<ProjectRow>(projectSql + " WHERE p.id=$1 AND p.team_id=$2", [projectId,teamId])).rows[0];
  if (!row) throw denied();
  await client.query("INSERT INTO workspace_project_state(project_id,team_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[row.id,teamId]);
  await client.query("SELECT project_id FROM workspace_project_state WHERE project_id=$1 FOR UPDATE",[row.id]);
  return (await client.query<ProjectRow>(projectSql + " WHERE p.id=$1 AND p.team_id=$2", [projectId,teamId])).rows[0];
}
async function audit(client: PoolClient, user: WorkspaceUser, teamId: string, action: string, entityId: string) {
  await client.query("INSERT INTO audit_events(team_id,actor_user_id,action,entity_type,entity_id) VALUES($1,$2,$3,'project',$4)",[teamId,user.id,action,entityId]);
}
async function appendSnapshot(client: PoolClient, user: WorkspaceUser, teamId: string, project: WorkspaceProject) {
  const previous = (await client.query<{id:string}>("SELECT id FROM annotations WHERE entity_type='project' AND entity_id=$1 AND field='workspace_snapshot' ORDER BY created_at DESC,id DESC LIMIT 1",[project.id])).rows[0];
  const snapshot = {...project};
  delete snapshot.nodePositions; delete snapshot.serverRevision;
  await client.query(`INSERT INTO annotations(team_id,entity_type,entity_id,field,author_user_id,body,source_method,provenance,supersedes_id,created_at)
    VALUES($1,'project',$2,'workspace_snapshot',$3,$4,'typed','student',$5,clock_timestamp())`,
    [teamId,project.id,user.id,JSON.stringify(snapshot),previous?.id ?? null]);
}
const entityType = (record: WorkspaceRecord) => record.kind === "source" ? "source_event" : record.kind;
async function saveNewRecord(client: PoolClient, user: WorkspaceUser, row: ProjectRow, record: WorkspaceRecord, imported: boolean) {
  const id = randomUUID();
  const type = entityType(record);
  await client.query(`INSERT INTO source_events(id,team_id,season_id,project_id,provider,provider_event_id,event_type,actor_user_id,title,summary,occurred_at,raw_metadata,content_hash,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'linked')`,
    [id,row.team_id,row.season_id,row.id,imported?"upload":"capture",row.id+":"+record.id,record.kind,imported?null:user.id,
      record.title,record.body,record.createdAt,JSON.stringify({workspaceLocalId:record.id,original:record,importedBy:imported?user.id:null,educationalOrigin:row.educational_origin}),
      hash(stable(record))]);
  if (record.kind === "iteration") {
    await client.query("INSERT INTO iterations(id,team_id,project_id,title,change_summary,created_by,opened_at,state,outcome,closed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [id,row.team_id,row.id,record.title,record.body,imported?null:user.id,record.createdAt,record.status==="closed"?"closed":"open",record.outcome??null,record.status==="closed"?new Date():null]);
  } else if (record.kind === "test") {
    await client.query(`INSERT INTO tests(id,team_id,project_id,title,target_type,target_label,metric_name,units,trials,successes,value,pass_criteria,environment,observations,outcome,performed_at,created_by)
      VALUES($1,$2,$3,$4,'project',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [id,row.team_id,row.id,record.title,record.revision ?? row.name,record.sourceType ?? null,record.unit ?? null,record.trials ?? null,
        record.successes ?? null,record.measuredValue ?? null,record.criterion ?? null,record.conditions ?? null,record.body,
        record.measuredValue == null && record.trials == null ? "qualitative" : "inconclusive",record.createdAt,imported?null:user.id]);
  } else if (record.kind === "decision") {
    await client.query("INSERT INTO decisions(id,team_id,project_id,title,status,author_user_id,decided_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [id,row.team_id,row.id,record.title,record.status==="draft"?"open":"closed",imported?null:user.id,record.createdAt]);
  }
  await client.query(`INSERT INTO workspace_entity_map(project_id,team_id,local_id,entity_type,entity_id,author_user_id,imported_by,original_author_label)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[row.id,row.team_id,record.id,type,id,imported?null:user.id,imported?user.id:null,record.originalAuthorLabel ?? record.author]);
  await client.query(`INSERT INTO annotations(team_id,entity_type,entity_id,field,author_user_id,body,source_method,provenance)
    VALUES($1,$2,$3,'workspace_record',$4,$5,$6,$7)`, [row.team_id,type,id,user.id,JSON.stringify(record),imported?"import":"typed",imported?"source":"student"]);
  if (record.rationale) await client.query(`INSERT INTO annotations(team_id,entity_type,entity_id,field,author_user_id,body,source_method,provenance)
    VALUES($1,$2,$3,'rationale',$4,$5,$6,$7)`,[row.team_id,type,id,user.id,record.rationale,imported?"import":"typed",imported?"source":"student"]);
  return {local_id:record.id,entity_type:type,entity_id:id,author_user_id:imported?null:user.id,imported_by:imported?user.id:null} as EntityRow;
}
async function saveRecordEdit(client: PoolClient, user: WorkspaceUser, row: ProjectRow, record: WorkspaceRecord, mapping: EntityRow) {
  if (mapping.author_user_id !== user.id && mapping.imported_by !== user.id) throw denied();
  if (mapping.entity_type !== entityType(record)) throw invalid("Тип существующей записи нельзя изменить.");
  const previous = (await client.query<{id:string}>(`SELECT id FROM annotations WHERE entity_id=$1 AND field='workspace_record' ORDER BY created_at DESC,id DESC LIMIT 1`,[mapping.entity_id])).rows[0];
  await client.query(`INSERT INTO annotations(team_id,entity_type,entity_id,field,author_user_id,body,source_method,provenance,supersedes_id,created_at)
    VALUES($1,$2,$3,'workspace_record',$4,$5,'typed','student',$6,clock_timestamp())`,
    [row.team_id,mapping.entity_type,mapping.entity_id,user.id,JSON.stringify(record),previous?.id ?? null]);
  // Source original is never updated. Structured projections are backed by the version chain.
  if (record.kind === "test") await client.query(`UPDATE tests SET title=$1,observations=$2,units=$3,trials=$4,successes=$5,value=$6,pass_criteria=$7,environment=$8 WHERE id=$9 AND team_id=$10`,
    [record.title,record.body,record.unit ?? null,record.trials ?? null,record.successes ?? null,record.measuredValue ?? null,record.criterion ?? null,record.conditions ?? null,mapping.entity_id,row.team_id]);
  if (record.kind === "decision") await client.query("UPDATE decisions SET title=$1,status=$2 WHERE id=$3 AND team_id=$4",[record.title,record.status==="draft"?"open":"closed",mapping.entity_id,row.team_id]);
  if (record.kind === "iteration") await client.query(`UPDATE iterations SET title=$1,change_summary=$2,state=$3,outcome=$4,
    closed_at=CASE WHEN $3='closed' THEN COALESCE(closed_at,now()) ELSE NULL END WHERE id=$5 AND team_id=$6`,
    [record.title,record.body,record.status==="closed"?"closed":"open",record.outcome??null,mapping.entity_id,row.team_id]);
  if (record.rationale) {
    const old = (await client.query<{id:string}>("SELECT id FROM annotations WHERE entity_id=$1 AND field='rationale' ORDER BY created_at DESC,id DESC LIMIT 1",[mapping.entity_id])).rows[0];
    await client.query(`INSERT INTO annotations(team_id,entity_type,entity_id,field,author_user_id,body,supersedes_id,created_at)
      VALUES($1,$2,$3,'rationale',$4,$5,$6,clock_timestamp())`,[row.team_id,mapping.entity_type,mapping.entity_id,user.id,record.rationale,old?.id ?? null]);
  }
}
const relationTypes = new Set(["RESPONDS_TO","IMPLEMENTS","MODIFIES","TESTS","SUPPORTS","CONTRADICTS","SUPERSEDES","DERIVED_FROM","CONTRIBUTED_BY","CAUSED_BY","LEADS_TO","REFERENCES","RELATED_TO"]);
async function saveLink(client: PoolClient, user: WorkspaceUser, row: ProjectRow, link: WorkspaceLink, mappings: Map<string,EntityRow>, imported: boolean) {
  const from=mappings.get(link.from), to=mappings.get(link.to), type=link.relationType || "RELATED_TO";
  if (!from || !to || from.entity_type==="relation" || to.entity_type==="relation") throw invalid("Связь ссылается на отсутствующую запись.");
  if (!relationTypes.has(type)) throw invalid("Неизвестный тип связи.");
  const id=randomUUID();
  await client.query(`INSERT INTO relations(id,team_id,from_type,from_id,to_type,to_id,relation_type,origin,status,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[id,row.team_id,from.entity_type,from.entity_id,to.entity_type,to.entity_id,type,
      link.status==="suggested"?"suggestion":imported?"system":"student",link.status,user.id]);
  await client.query(`INSERT INTO workspace_entity_map(project_id,team_id,local_id,entity_type,entity_id,author_user_id,imported_by)
    VALUES($1,$2,$3,'relation',$4,$5,$6)`,[row.id,row.team_id,link.id,id,imported?null:user.id,imported?user.id:null]);
}
async function saveProjectChange(client: PoolClient, user: WorkspaceUser, row: ProjectRow, before: WorkspaceProject, after: WorkspaceProject, layoutOnly: boolean, imported=false) {
  if (!layoutOnly) {
    const maps=(await client.query<EntityRow>("SELECT * FROM workspace_entity_map WHERE project_id=$1 AND team_id=$2",[row.id,row.team_id])).rows;
    const mapping=new Map(maps.map(item=>[item.local_id,item]));
    for (const record of after.records) {
      const existing=before.records.find(item=>item.id===record.id);
      if (!existing) mapping.set(record.id,await saveNewRecord(client,user,row,record,imported));
      else if(stable(record)!==stable(existing)) {
        const mapped=mapping.get(record.id); if (!mapped) throw invalid("У записи нет серверного источника.");
        await saveRecordEdit(client,user,row,record,mapped);
      }
    }
    for(const link of after.links) if(!before.links.some(item=>item.id===link.id)) await saveLink(client,user,row,link,mapping,imported);
    for(const link of before.links) if(!after.links.some(item=>item.id===link.id)) {
      const mapped=mapping.get(link.id);
      if (!mapped) throw invalid("У связи нет серверного источника.");
      await client.query("UPDATE relations SET invalidated_at=now() WHERE id=$1 AND team_id=$2",[mapped.entity_id,row.team_id]);
    }
    await appendSnapshot(client,user,row.team_id,after);
  }
  await client.query("UPDATE workspace_project_state SET revision=revision+1,node_positions=$1,updated_at=now() WHERE project_id=$2 AND team_id=$3",[JSON.stringify(after.nodePositions ?? {}),row.id,row.team_id]);
  await audit(client,user,row.team_id,layoutOnly?"workspace.layout":"workspace.changed",row.id);
}
async function newProject(client: PoolClient, user: WorkspaceUser, teamId: string, project: WorkspaceProject) {
  // Serialize the technical team quota across concurrent project/import requests.
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["workspace-project-quota:"+teamId]);
  const count=await client.query<{count:string}>("SELECT count(*) FROM projects WHERE team_id=$1",[teamId]);
  if(Number(count.rows[0].count)>=20) throw invalid("Достигнут технический лимит 20 проектов на команду.");
  const season=(await client.query<{id:string}>("SELECT id FROM seasons WHERE team_id=$1 AND is_active=true ORDER BY created_at DESC LIMIT 1",[teamId])).rows[0];
  if(!season) throw invalid("У команды нет активного сезона.");
  const id=randomUUID();
  await client.query("INSERT INTO projects(id,team_id,season_id,name,description) VALUES($1,$2,$3,$4,$5)",[id,teamId,season.id,project.name,project.description]);
  await client.query("INSERT INTO workspace_project_state(project_id,team_id,created_by,educational_origin,import_manifest) VALUES($1,$2,$3,$4,$5)",
    [id,teamId,user.id,project.educationalOrigin===true || project.dataKind==="synthetic",project.importManifest ? JSON.stringify(project.importManifest):null]);
  return currentProject(client,id,teamId);
}

/** Media pipelines call inside workspaceTransaction so file metadata and evidence
 * are committed together. Do not call through a second/nested transaction. */
export async function appendWorkspaceRecord(client: PoolClient, user: WorkspaceUser, projectId: string, values: Record<string,unknown>) {
  const scoped=(await client.query<{team_id:string}>("SELECT team_id FROM projects WHERE id=$1",[uuid.parse(projectId)])).rows[0];
  if(!scoped) throw denied();
  const membership=(await client.query<{role:string}>("SELECT role FROM team_memberships WHERE team_id=$1 AND user_id=$2 AND status='active'",[scoped.team_id,user.id])).rows[0];
  if(!membership) throw denied();
  student(membership.role);
  const row=await currentProject(client,projectId,scoped.team_id),before=projectView(row),memory=validator(before);
  const recordId=memory.addRecord({...values,author:user.displayName});
  await saveProjectChange(client,user,row,before,memory.getProject(),false);
  const mapping=(await client.query<{entity_id:string}>("SELECT entity_id FROM workspace_entity_map WHERE project_id=$1 AND local_id=$2",[projectId,recordId])).rows[0];
  return {recordId,sourceEventId:mapping.entity_id,teamId:scoped.team_id};
}

/** Signed external metadata is a source, never a student-authored explanation.
 * Called in the receipt transaction: canonical source, mapping and feed snapshot
 * either all commit or all roll back. The connector owner is not the commit author. */
export async function appendExternalWorkspaceSource(client: PoolClient, user: WorkspaceUser, projectId: string, source: {
  connectionId:string; providerEventId:string; title:string; body:string; occurredAt:string;
  actor:string; revision:string; metadata:Record<string,unknown>; contentHash:string;
}) {
  const scoped=(await client.query<{team_id:string}>("SELECT team_id FROM projects WHERE id=$1",[uuid.parse(projectId)])).rows[0];
  if(!scoped)throw denied();
  const membership=(await client.query<{role:string}>("SELECT role FROM team_memberships WHERE team_id=$1 AND user_id=$2 AND status='active'",[scoped.team_id,user.id])).rows[0];
  if(!membership)throw denied();student(membership.role);
  const row=await currentProject(client,projectId,scoped.team_id),before=projectView(row);
  const previous=await client.query<{id:string}>("SELECT id FROM source_events WHERE team_id=$1 AND provider='github' AND provider_event_id=$2",[scoped.team_id,source.providerEventId]);
  if(previous.rowCount)return {inserted:false,sourceEventId:previous.rows[0].id};
  const memory=validator(before),recordId=memory.addRecord({kind:"source",title:source.title,body:source.body,
    author:source.actor,createdAt:source.occurredAt,sourceType:"GitHub · external author",revision:source.revision});
  const after=memory.getProject(),record=after.records.find(r=>r.id===recordId)!;
  const id=randomUUID();
  await client.query(`INSERT INTO source_events(id,team_id,season_id,project_id,connection_id,provider,provider_event_id,event_type,actor_external_id,title,summary,occurred_at,raw_metadata,content_hash,status)
    VALUES($1,$2,$3,$4,$5,'github',$6,'commit',$7,$8,$9,$10,$11,$12,'inbox')`,
    [id,row.team_id,row.season_id,row.id,source.connectionId,source.providerEventId,source.actor,source.title,source.body,source.occurredAt,
      JSON.stringify({...source.metadata,workspaceLocalId:recordId,externalAuthorshipUnverified:true}),source.contentHash]);
  await client.query(`INSERT INTO workspace_entity_map(project_id,team_id,local_id,entity_type,entity_id,original_author_label)
    VALUES($1,$2,$3,'source_event',$4,$5)`,[row.id,row.team_id,recordId,id,source.actor]);
  await client.query(`INSERT INTO annotations(team_id,entity_type,entity_id,field,author_user_id,body,source_method,provenance)
    VALUES($1,'source_event',$2,'workspace_record',$3,$4,'import','source')`,[row.team_id,id,user.id,JSON.stringify(record)]);
  await appendSnapshot(client,user,row.team_id,after);
  await client.query("UPDATE workspace_project_state SET revision=revision+1,updated_at=now() WHERE project_id=$1 AND team_id=$2",[row.id,row.team_id]);
  await audit(client,user,row.team_id,"workspace.github.source",row.id);
  return {inserted:true,sourceEventId:id};
}

export async function executeWorkspaceCommand(user: WorkspaceUser, raw: unknown, options: {origin?: string; afterCanonicalWrite?: () => void} = {}) {
  const input=workspaceCommand.parse(raw);
  // Count failed attempts too: this write deliberately occurs outside the
  // domain transaction, so an invalid/reused invite cannot roll its limit back.
  const invitation=["createInvite","joinInvite","createTeam"].includes(input.command);
  const windowMs=invitation?900000:60000;
  const window=new Date(Math.floor(Date.now()/windowMs)*windowMs);
  const attempts=await pool.query<{attempts:number}>(`INSERT INTO account_rate_limits(key_hash,window_started_at,attempts) VALUES($1,$2,1)
    ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN account_rate_limits.window_started_at=EXCLUDED.window_started_at
    THEN account_rate_limits.attempts+1 ELSE 1 END,window_started_at=EXCLUDED.window_started_at RETURNING attempts`,
    [hash("workspace:"+user.id+":"+(invitation?input.command:"write")),window]);
  if(attempts.rows[0].attempts>(invitation?20:180))throw new WorkspaceError("rate_limited",429,"Слишком много запросов. Подождите перед повтором.");
  const outcome=await workspaceTransaction(user,async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[user.id+":"+input.requestId]);
    const digest=hash(stable(input));
    const prior=(await client.query<{payload_hash:string;result:Receipt}>("SELECT payload_hash,result FROM workspace_requests WHERE user_id=$1 AND request_id=$2",[user.id,input.requestId])).rows[0];
    if(prior) {
      if(prior.payload_hash!==digest) throw new WorkspaceError("idempotency_conflict",409,"Этот запрос уже использован с другими данными.");
      const state=await bootstrap(client,user,prior.result.teamId,prior.result.projectId);
      let replayResult=prior.result.result;
      if(input.command==="createInvite"){
        if(state.role!=="student_lead")throw denied();
        if(replayResult&&typeof replayResult==="object"&&"encryptedInviteResult" in replayResult)
          replayResult=JSON.parse(decryptSecret(String(replayResult.encryptedInviteResult)));
      }
      return {...state,result:replayResult,replayed:true};
    }
    const recent=await client.query<{count:string}>("SELECT count(*) FROM workspace_requests WHERE user_id=$1 AND created_at>now()-interval '1 minute'",[user.id]);
    if(Number(recent.rows[0].count)>=180) throw new WorkspaceError("rate_limited",429,"Слишком много изменений. Подождите минуту.");
    let teamId:string|null=null, projectId:string|null=null, result:unknown=null;
    if(input.command==="createTeam") {
      const draft=fields(input.args[0]);
      const data=z.object({name:z.string().trim().min(1).max(120),season:z.string().trim().min(1).max(80),project:z.string().trim().min(1).max(120),
        timezone:z.string().min(1).max(80).default("Asia/Qyzylorda"),program:z.enum(["FTC","VEX","FRC","ISEF","OTHER"]).default("FTC"),locale:z.enum(["ru","en","kk"]).default("ru")}).parse({...draft,name:draft.name??draft.teamName,season:draft.season??draft.seasonName,project:draft.project??draft.projectName});
      const created=(await client.query<{team_id:string;project_id:string}>("SELECT * FROM workspace_create_team($1,$2,$3,$4,$5,$6)",[data.name,data.season,data.project,data.timezone,data.program,data.locale])).rows[0];
      teamId=created.team_id;projectId=created.project_id;result={teamId,projectId};
    } else if(input.command==="joinInvite") {
      const data=z.object({token:z.string()}).strict().parse(input.args[0]),invite=parseInviteToken(data.token);
      let joined:{team_id:string};
      try{joined=(await client.query<{team_id:string}>("SELECT workspace_join_invite($1) AS team_id",[invite.codeHash])).rows[0];}
      catch(error){if(error&&typeof error==="object"&&"code" in error&&error.code==="42501")throw new WorkspaceError("invite_unavailable",403,"Код недоступен: проверьте его или попросите ответственного участника создать новый.");throw error;}
      teamId=joined.team_id; result={teamId};
    } else {
      const teams=await memberships(client,user.id);
      let wanted=input.teamId;
      if(input.projectId) {
        const project=(await client.query<{team_id:string}>("SELECT team_id FROM projects WHERE id=$1",[input.projectId])).rows[0];
        if(!project) throw denied();
        if(wanted && wanted!==project.team_id) throw denied();
        wanted=project.team_id;
      }
      if(input.command==="selectTeam") wanted=uuid.parse(fields(input.args[0]).teamId);
      const team=wanted?teams.find(item=>item.id===wanted):teams[0]; if(!team) throw denied();
      teamId=team.id; projectId=input.projectId??null;
      if(input.command==="createInvite") {
        if(team.role!=="student_lead") throw denied();
        const data=inviteCreation.parse(input.args[0] ?? {});
        const isCode=data.kind==="team_code";
        if(isCode&&(!process.env.SECRETS_ENCRYPTION_KEY||process.env.SECRETS_ENCRYPTION_KEY.length<32))throw new WorkspaceError("encryption_unconfigured",503,"Коды команды временно недоступны. Настройте серверный ключ шифрования.");
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["workspace-invite-create:"+team.id]);
        if(isCode){const count=Number((await client.query<{count:string}>("SELECT count(*) FROM team_invites WHERE team_id=$1 AND kind='team_code' AND revoked_at IS NULL AND expires_at>now() AND uses<max_uses",[team.id])).rows[0].count);if(count>=5)throw new WorkspaceError("invite_limit",422,"Сначала отзовите один из действующих кодов команды.");}
        const expiresAt=new Date(Date.now()+(isCode?data.expiresInDays:7)*86400000).toISOString(),maxUses=isCode?data.maxUses:1;
        let created:{id:string}|undefined,displayCode="",token="";
        for(let attempt=0;attempt<5&&!created;attempt++){
          let codeHash:string;
          if(isCode){const generated=newTeamInviteCode();displayCode=generated.code;codeHash=generated.codeHash;}
          else {token=randomBytes(32).toString("base64url");codeHash=hash(token);}
          created=(await client.query<{id:string}>(`INSERT INTO team_invites(team_id,code,role,email,max_uses,expires_at,created_by,kind)
            VALUES($1,$2,'student',$3,$4,$5,$6,$7) ON CONFLICT(code) DO NOTHING RETURNING id`,[team.id,codeHash,isCode?null:data.email??null,maxUses,expiresAt,user.id,isCode?"team_code":"individual"])).rows[0];
        }
        if(!created)throw new WorkspaceError("service_unavailable",503,"Не удалось создать код. Повторите запрос.");
        result=isCode?{inviteId:created.id,kind:"team_code",inviteCode:displayCode,inviteUrl:(options.origin??"")+"/join/"+displayCode,maxUses,expiresAt}
          :{inviteId:created.id,kind:"individual",inviteUrl:(options.origin??"")+"/onboarding?invite="+encodeURIComponent(token),maxUses,expiresAt};
        await client.query("INSERT INTO audit_events(team_id,actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'team.invite.created','team_invite',$3,$4)",[team.id,user.id,created.id,JSON.stringify({kind:isCode?"team_code":"individual",maxUses,expiresAt})]);
      } else if(input.command==="selectTeam") { result={teamId}; projectId=null; }
      else {
        student(team.role);
        if(input.command==="createProject") {
          const memory=validator(); memory.createProject(input.args[0]); const project=memory.getProject();
          const row=await newProject(client,user,team.id,project);
          await appendSnapshot(client,user,team.id,{...project,id:row.id}); projectId=row.id;result=row.id;
        } else if(input.command==="previewImport" || input.command==="importProject") {
          const text=z.string().max(2097152).parse(input.args[0]); if(Buffer.byteLength(text)>2097152) throw invalid("Импорт не больше 2 MiB.");
          const memory=validator(); memory.importProject(text); const imported=memory.getProject();
          if(input.command==="previewImport") {
            const preview=(await client.query<{id:string;expires_at:Date}>("INSERT INTO workspace_import_previews(user_id,team_id,payload_hash) VALUES($1,$2,$3) RETURNING id,expires_at",[user.id,team.id,hash(text)])).rows[0];
            result={previewId:preview.id,projectName:imported.name,records:imported.records.length,links:imported.links.length,studyRows:imported.studyRows.length,
              educationalOrigin:imported.educationalOrigin===true,warnings:[...(imported.importWarnings??[]),"Исходные имена авторов не подтверждают личность аккаунта. Файлы, отсутствующие в JSON, не будут созданы."],expiresAt:preview.expires_at.toISOString()};
          } else {
            const confirmation=z.object({previewId:uuid}).strict().parse(input.args[1]);
            const preview=(await client.query<{payload_hash:string;expires_at:Date;committed_project_id:string|null}>(`SELECT * FROM workspace_import_previews WHERE id=$1 AND user_id=$2 AND team_id=$3 FOR UPDATE`,[confirmation.previewId,user.id,team.id])).rows[0];
            if(!preview || preview.payload_hash!==hash(text) || preview.expires_at.getTime()<Date.now()) throw new WorkspaceError("preview_expired",409,"Подтвердите новый просмотр импорта; файл или команда изменились.");
            if(preview.committed_project_id) {projectId=preview.committed_project_id;result=projectId;}
            else {
              const row=await newProject(client,user,team.id,imported);
              const after={...imported,id:row.id,dataKind:"personal" as const};
              await saveProjectChange(client,user,row,projectView(row),after,false,true);
              options.afterCanonicalWrite?.();
              await client.query("UPDATE workspace_import_previews SET committed_project_id=$1 WHERE id=$2",[row.id,confirmation.previewId]);
              projectId=row.id;result=row.id;
            }
          }
        } else {
          if(!projectId) throw invalid("Выберите проект.");
          const row=await currentProject(client,projectId,team.id);
          if(input.expectedRevision!==row.revision) {
            if(input.command!=="updateRecord")throw new WorkspaceError("revision_conflict",409,"Проект изменён другим участником. Ваш ввод не сохранён поверх его работы. Обновите проект и сравните версии.");
            const recordId=z.string().max(80).parse(input.args[0]),values=fields(input.args[1]);
            const mapping=(await client.query<EntityRow>("SELECT * FROM workspace_entity_map WHERE project_id=$1 AND local_id=$2",[row.id,recordId])).rows[0];
            if(!mapping||(mapping.author_user_id!==user.id&&mapping.imported_by!==user.id))throw denied();
            const current=projectView(row),existing=current.records.find(item=>item.id===recordId);
            if(!existing)throw invalid("Запись не найдена.");
            const memory=validator(current);memory.updateRecord(recordId,{...values,author:existing.author});
            const proposal=memory.getProject().records.find(item=>item.id===recordId)!;
            const draft=(await client.query<{id:string}>(`INSERT INTO annotations(team_id,entity_type,entity_id,field,author_user_id,body,source_method,provenance) VALUES($1,$2,$3,'workspace_conflict',$4,$5,'typed','student') RETURNING id`,[team.id,mapping.entity_type,mapping.entity_id,user.id,JSON.stringify({expectedRevision:input.expectedRevision??null,currentRevision:row.revision,record:proposal})])).rows[0];
            const result={conflictDraftId:draft.id};
            await client.query("INSERT INTO workspace_requests(user_id,request_id,payload_hash,team_id,result) VALUES($1,$2,$3,$4,$5)",[user.id,input.requestId,digest,team.id,JSON.stringify({teamId:team.id,projectId:row.id,result})]);
            return {...await bootstrap(client,user,team.id,row.id),result};
          }
          const before=projectView(row), memory=validator(before);
          const args=input.args;
          if(input.command==="addRecord") {
            const values=fields(args[0]);
            if(values.recordHistory || values.annotationHistory || values.nativeRef) throw invalid("История источника переносится через подтверждённый импорт.");
            result=memory.addRecord({...values,author:user.displayName});
            if(values.relatedRecordId) {
              const related=z.string().max(80).parse(values.relatedRecordId);
              const created=memory.getProject().records.find(record=>record.id===result)!;
              const target=before.records.find(record=>record.id===related); if(!target) throw invalid("Связанная запись не найдена.");
              const testToDecision=target.kind==="test" && created.kind==="decision";
              memory.addLink({from:testToDecision?target.id:created.id,to:testToDecision?created.id:target.id,
                label:testToDecision?"Испытание обосновывает решение":"Связанный материал",relationType:testToDecision?"SUPPORTS":"REFERENCES",status:"accepted",origin:"student"});
            }
          } else if(input.command==="updateRecord") {
            const id=z.string().max(80).parse(args[0]),values=fields(args[1]);
            const existing=before.records.find(record=>record.id===id);
            if(!existing) throw invalid("Запись не найдена.");
            memory.updateRecord(id,{...values,author:existing.author});
          } else if(input.command==="triageSource") {
            const triage=z.object({sourceId:uuid,status:z.enum(["inbox","linked","ignored"]),iterationId:z.string().min(1).max(80).optional(),relationType:z.enum(["DERIVED_FROM","REFERENCES"]).default("DERIVED_FROM")}).strict().parse(args[0]);
            const source=(await client.query<{id:string;local_id:string;status:string;iteration_id:string|null}>(`SELECT s.id,s.status,s.iteration_id,m.local_id
              FROM source_events s JOIN workspace_entity_map m ON m.entity_id=s.id AND m.entity_type='source_event'
              WHERE s.id=$1 AND s.project_id=$2 AND s.team_id=$3 AND m.project_id=$2 FOR UPDATE OF s`,[triage.sourceId,row.id,team.id])).rows[0];
            if(!source)throw denied();
            let iterationEntityId:string|null=source.iteration_id;
            if(triage.status==="linked"){
              if(!triage.iterationId)throw invalid("Выберите точную версию проекта для материала.");
              const iteration=before.records.find(record=>record.id===triage.iterationId && record.kind==="iteration");
              if(!iteration)throw invalid("Версия не найдена в текущем проекте.");
              const target=(await client.query<{entity_id:string}>("SELECT entity_id FROM workspace_entity_map WHERE project_id=$1 AND team_id=$2 AND local_id=$3 AND entity_type='iteration'",[row.id,team.id,iteration.id])).rows[0];
              if(!target)throw denied();iterationEntityId=target.entity_id;
              const existing=before.links.find(link=>link.from===iteration.id && link.to===source.local_id && link.relationType===triage.relationType);
              if(existing && existing.status!=="accepted")memory.removeLink(existing.id);
              if(!existing || existing.status!=="accepted")memory.addLink({from:iteration.id,to:source.local_id,relationType:triage.relationType,
                label:triage.relationType==="DERIVED_FROM"?"Версия основана на материале":"Версия ссылается на материал",status:"accepted",origin:"student"});
            }
            // Ignore/restore changes triage only. Preserve past engineering links
            // and exact iteration provenance; originals and author fields stay intact.
            await client.query("UPDATE source_events SET status=$1,iteration_id=$2 WHERE id=$3 AND project_id=$4",[triage.status,iterationEntityId,source.id,row.id]);
            await client.query(`INSERT INTO audit_events(team_id,actor_user_id,action,entity_type,entity_id,metadata)
              VALUES($1,$2,'source.triaged','source_event',$3,$4)`,[team.id,user.id,source.id,JSON.stringify({before:{status:source.status,iterationId:source.iteration_id},after:{status:triage.status,iterationId:iterationEntityId}})]);
            result={sourceId:source.id,status:triage.status,iterationId:triage.iterationId??null};
          } else if(input.command==="addLink") result=memory.addLink(args[0]);
          else if(input.command==="removeLink") memory.removeLink(z.string().parse(args[0]));
          else if(input.command==="setNodePosition") memory.setNodePosition(z.string().parse(args[0]),args[1]);
          else if(input.command==="resetNodePositions") memory.resetNodePositions();
          else if(input.command==="addStudyRow") result=memory.addStudyRow(args[0]);
          else if(input.command==="addStudyRows") result=memory.addStudyRows(args[0]);
          const after=memory.getProject();
          await saveProjectChange(client,user,row,before,after,["setNodePosition","resetNodePositions"].includes(input.command));
          options.afterCanonicalWrite?.();
        }
      }
    }
    // A lost-response retry must return the same code without persisting its
    // plaintext in the otherwise readable idempotency receipt.
    const receipt:Receipt={teamId,projectId,result:input.command==="createInvite"?{encryptedInviteResult:encryptSecret(JSON.stringify(result))}:result};
    await client.query("INSERT INTO workspace_requests(user_id,request_id,payload_hash,team_id,result) VALUES($1,$2,$3,$4,$5)",[user.id,input.requestId,digest,teamId,JSON.stringify(receipt)]);
    return {...await bootstrap(client,user,teamId,projectId),result};
  });
  if(outcome.result&&typeof outcome.result==='object'&&'conflictDraftId' in outcome.result)throw new WorkspaceError('revision_conflict',409,'Спорный вариант сохранён отдельно. Сравните его с текущей версией.',{draftId:String(outcome.result.conflictDraftId)});
  return outcome;
}


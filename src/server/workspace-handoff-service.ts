import {z} from "zod";
import {createHash,randomUUID} from "node:crypto";
import {workspaceTransaction,WorkspaceError,type WorkspaceUser} from "./workspace-service";

/** Reading season context never archives a season or copies authored content. */
export async function getWorkspaceHandoff(user:WorkspaceUser,projectId:string) {
  z.string().uuid().parse(projectId);
  return workspaceTransaction(user,async client=>{
    const current=(await client.query<{team_id:string;season_id:string;name:string;year:number;is_active:boolean;handoff_completed_at:Date|null;role:string;revision:number;subsystem_count:number}>(`SELECT p.team_id,p.season_id,s.name,s.year,s.is_active,s.handoff_completed_at,m.role,COALESCE(w.revision,0) AS revision,
      (SELECT count(*)::int FROM subsystems WHERE project_id=p.id) AS subsystem_count
      FROM projects p JOIN seasons s ON s.id=p.season_id AND s.team_id=p.team_id
      LEFT JOIN workspace_project_state w ON w.project_id=p.id
      JOIN team_memberships m ON m.team_id=p.team_id AND m.user_id=$2 AND m.status='active' WHERE p.id=$1`,[projectId,user.id])).rows[0];
    if(!current)throw new WorkspaceError("forbidden",403,"Нет доступа к проекту.");
    const projects=(await client.query<{id:string;name:string;seasonId:string;seasonName:string;year:number;active:boolean}>(`SELECT p.id,p.name,s.id AS "seasonId",s.name AS "seasonName",s.year,s.is_active AS active FROM projects p
      JOIN seasons s ON s.id=p.season_id AND s.team_id=p.team_id WHERE p.team_id=$1 ORDER BY s.year DESC,s.created_at DESC,p.created_at,p.id LIMIT 200`,[current.team_id])).rows;
    return {season:{id:current.season_id,name:current.name,year:current.year,active:current.is_active,handoffCompletedAt:current.handoff_completed_at?.toISOString()||null},projects,role:current.role,revision:current.revision,subsystemCount:current.subsystem_count,canStartNextSeason:current.role==="student_lead"&&current.is_active};
  });
}

export const nextSeasonInput=z.object({
  projectId:z.string().uuid(),expectedSeasonId:z.string().uuid(),expectedProjectRevision:z.number().int().nonnegative(),requestId:z.string().uuid(),
  seasonName:z.string().trim().min(1).max(80),year:z.number().int().min(2000).max(2100),projectName:z.string().trim().min(1).max(120),
  carrySubsystems:z.boolean().default(false),acknowledge:z.literal(true),
}).strict();
const nextSeasonResult=z.object({sourceProjectId:z.string().uuid(),sourceSeasonId:z.string().uuid(),projectId:z.string().uuid(),seasonId:z.string().uuid(),seasonName:z.string(),projectName:z.string(),copiedSubsystems:z.number().int().nonnegative(),policyStatus:z.literal("unreviewed")}).strict();

/** Only the lead can explicitly start a new empty season. All state changes,
 * policy anchors and the retry receipt commit in one transaction. */
export async function startWorkspaceSeason(user:WorkspaceUser,raw:unknown,options:{afterCanonicalWrite?:()=>void}={}) {
  const input=nextSeasonInput.parse(raw),digest=createHash("sha256").update(JSON.stringify({command:"startWorkspaceSeason",...input})).digest("hex");
  return workspaceTransaction(user,async client=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[user.id+":"+input.requestId]);
    const source=(await client.query<{team_id:string;season_id:string;project_name:string;season_name:string;year:number;is_active:boolean;handoff_curated:Record<string,unknown>;competition_profile_id:string|null;role:string}>(`SELECT p.team_id,p.season_id,p.name AS project_name,s.name AS season_name,s.year,s.is_active,s.handoff_curated,t.competition_profile_id,m.role
      FROM projects p JOIN seasons s ON s.id=p.season_id AND s.team_id=p.team_id JOIN teams t ON t.id=p.team_id
      JOIN team_memberships m ON m.team_id=p.team_id AND m.user_id=$2 AND m.status='active' WHERE p.id=$1`,[input.projectId,user.id])).rows[0];
    if(!source||source.role!=="student_lead")throw new WorkspaceError("forbidden",403,"Начать новый сезон может руководитель команды учащихся.");
    const receipt=(await client.query<{payload_hash:string;result:unknown}>("SELECT payload_hash,result FROM workspace_requests WHERE user_id=$1 AND request_id=$2",[user.id,input.requestId])).rows[0];
    if(receipt){if(receipt.payload_hash!==digest)throw new WorkspaceError("idempotency_conflict",409,"Этот запрос уже использован с другими данными.");const saved=z.object({result:nextSeasonResult}).safeParse(receipt.result);if(!saved.success)throw new WorkspaceError("invalid_saved_project",500,"Сохранённый результат перехода не удалось проверить.");return {...saved.data.result,replayed:true};}
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["workspace-project-quota:"+source.team_id]);
    const active=(await client.query<{id:string;handoff_curated:Record<string,unknown>}>("SELECT id,handoff_curated FROM seasons WHERE team_id=$1 AND is_active=true FOR UPDATE",[source.team_id])).rows;
    if(active.length!==1||active[0].id!==input.expectedSeasonId||source.season_id!==input.expectedSeasonId)throw new WorkspaceError("season_state_changed",409,"Активный сезон изменился. Откройте передачу заново и проверьте состав.");
    const state=(await client.query<{revision:number}>("SELECT revision FROM workspace_project_state WHERE project_id=$1 FOR UPDATE",[input.projectId])).rows[0];
    if((state?.revision??0)!==input.expectedProjectRevision)throw new WorkspaceError("revision_conflict",409,"Исходный проект изменился. Проверьте материалы перед переходом.");
    if(input.year<=source.year)throw new WorkspaceError("invalid_fields",422,"Новый сезон должен следовать за исходным.");
    if((await client.query("SELECT 1 FROM seasons WHERE team_id=$1 AND lower(name)=lower($2)",[source.team_id,input.seasonName])).rowCount)throw new WorkspaceError("season_exists",409,"Сезон с таким названием уже существует. Откройте его в списке проектов.");
    if(Number((await client.query<{count:string}>("SELECT count(*) FROM projects WHERE team_id=$1",[source.team_id])).rows[0].count)>=20)throw new WorkspaceError("invalid_fields",422,"Достигнут технический лимит 20 проектов команды.");
    const pinnedAt=new Date().toISOString(),curated=active[0].handoff_curated??{};
    if(!Object.hasOwn(curated,"izneraPolicyAnchor")){
      const policy=source.competition_profile_id?(await client.query<{id:string}>(`SELECT id FROM policy_versions WHERE profile_id=$1 AND constraints->>'season'=$2
        ORDER BY (status='active') DESC,created_at DESC,id DESC LIMIT 1`,[source.competition_profile_id,source.season_name])).rows[0]:undefined;
      const anchor={schemaVersion:1,versionId:policy?.id??null,profileId:source.competition_profile_id,pinnedAt,reason:"season_handoff"};
      await client.query("UPDATE seasons SET handoff_curated=jsonb_set(COALESCE(handoff_curated,'{}'::jsonb),'{izneraPolicyAnchor}',$2::jsonb,true) WHERE id=$1 AND team_id=$3",[source.season_id,JSON.stringify(anchor),source.team_id]);
    }
    const seasonId=randomUUID(),projectId=randomUUID(),newAnchor={schemaVersion:1,versionId:null,profileId:null,pinnedAt,reason:"new_season_unreviewed"};
    await client.query("UPDATE seasons SET is_active=false WHERE id=$1 AND team_id=$2",[source.season_id,source.team_id]);
    await client.query("INSERT INTO seasons(id,team_id,name,year,is_active,handoff_curated) VALUES($1,$2,$3,$4,true,$5::jsonb)",[seasonId,source.team_id,input.seasonName,input.year,JSON.stringify({izneraPolicyAnchor:newAnchor})]);
    await client.query("INSERT INTO projects(id,team_id,season_id,name,description) VALUES($1,$2,$3,$4,'')",[projectId,source.team_id,seasonId,input.projectName]);
    await client.query("INSERT INTO workspace_project_state(project_id,team_id,created_by) VALUES($1,$2,$3)",[projectId,source.team_id,user.id]);
    let copiedSubsystems=0;
    if(input.carrySubsystems){const inserted=await client.query(`INSERT INTO subsystems(team_id,project_id,name)
      SELECT $1,$2,n.name FROM (SELECT DISTINCT ON (lower(name)) name FROM subsystems WHERE project_id=$3 AND team_id=$1 ORDER BY lower(name),created_at,id LIMIT 500) n`,[source.team_id,projectId,input.projectId]);copiedSubsystems=inserted.rowCount??0;}
    options.afterCanonicalWrite?.();
    const result=nextSeasonResult.parse({sourceProjectId:input.projectId,sourceSeasonId:source.season_id,projectId,seasonId,seasonName:input.seasonName,projectName:input.projectName,copiedSubsystems,policyStatus:"unreviewed"});
    await client.query("INSERT INTO audit_events(team_id,actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,$2,'season.started','season',$3,$4::jsonb)",[source.team_id,user.id,seasonId,JSON.stringify({sourceSeasonId:source.season_id,sourceProjectId:input.projectId,projectId,copiedSubsystems,policyInherited:false})]);
    await client.query("INSERT INTO workspace_requests(user_id,request_id,payload_hash,team_id,result) VALUES($1,$2,$3,$4,$5::jsonb)",[user.id,input.requestId,digest,source.team_id,JSON.stringify({teamId:source.team_id,projectId,result})]);
    return {...result,replayed:false};
  });
}

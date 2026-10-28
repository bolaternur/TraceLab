import {z} from "zod";
import {executeWorkspaceCommand,workspaceTransaction,WorkspaceError,type WorkspaceUser} from "./workspace-service";
const uuid=z.string().uuid(),state=z.enum(["inbox","linked","ignored"]);
const cursorSchema=z.object({project:uuid,status:state,time:z.iso.datetime().max(40),id:uuid}).strict();
export const inboxCommand=z.discriminatedUnion("command",[
  z.object({command:z.literal("triage"),projectId:uuid,requestId:uuid,expectedRevision:z.number().int().nonnegative(),sourceId:uuid,status:state,iterationId:z.string().min(1).max(80).optional(),relationType:z.enum(["DERIVED_FROM","REFERENCES"]).default("DERIVED_FROM")}).strict(),
  z.object({command:z.literal("iteration"),projectId:uuid,requestId:uuid,expectedRevision:z.number().int().nonnegative(),iterationId:z.string().min(1).max(80),status:z.enum(["draft","closed"]),body:z.string().max(12000),rationale:z.string().max(12000),outcome:z.enum(["kept","reverted","iterate","deferred","rejected",""]),nextStep:z.string().max(2000)}).strict(),
]);
export async function getWorkspaceInbox(user:WorkspaceUser,projectId:string,options:{status?:string|null;cursor?:string|null}={}){
  uuid.parse(projectId);const wanted=state.parse(options.status||"inbox");
  let cursor:z.infer<typeof cursorSchema>|undefined;
  if(options.cursor){if(options.cursor.length>1024)throw new WorkspaceError("invalid_cursor",422,"Обновите список материалов.");
    try{cursor=cursorSchema.parse(JSON.parse(Buffer.from(options.cursor,"base64url").toString("utf8")));}catch{throw new WorkspaceError("invalid_cursor",422,"Обновите список материалов.");}
    if(cursor.project!==projectId || cursor.status!==wanted)throw new WorkspaceError("invalid_cursor",422,"Фильтр списка изменился; начните с первой страницы.");}
  return workspaceTransaction(user,async client=>{
    const access=(await client.query<{team_id:string;role:string;revision:number}>(`SELECT p.team_id,m.role,COALESCE(s.revision,0) AS revision FROM projects p
      JOIN team_memberships m ON m.team_id=p.team_id AND m.user_id=$2 AND m.status='active'
      LEFT JOIN workspace_project_state s ON s.project_id=p.id WHERE p.id=$1`,[projectId,user.id])).rows[0];
    if(!access)throw new WorkspaceError("forbidden",403,"Нет доступа к проекту.");
    const rows=(await client.query(`SELECT s.id AS "sourceId",m.local_id AS "recordId",s.title,s.summary,s.provider,s.event_type AS "eventType",s.status,
      s.actor_external_id AS "externalActor",u.display_name AS "authorName",s.occurred_at AS "occurredAt",s.received_at AS "receivedAt",
      to_char(s.received_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorTime",
      im.local_id AS "iterationId",jsonb_build_object('repository',s.raw_metadata->>'repository','sha',s.raw_metadata->>'sha',
        'branch',s.raw_metadata->>'branch','url',s.raw_metadata->>'url','externalAuthorshipUnverified',s.raw_metadata->'externalAuthorshipUnverified') AS metadata
      FROM source_events s JOIN workspace_entity_map m ON m.entity_id=s.id AND m.entity_type='source_event' AND m.project_id=s.project_id
      LEFT JOIN workspace_entity_map im ON im.entity_id=s.iteration_id AND im.entity_type='iteration' AND im.project_id=s.project_id
      LEFT JOIN users u ON u.id=s.actor_user_id
      WHERE s.project_id=$1 AND s.team_id=$2 AND s.status=$3 ${cursor?"AND (s.received_at,s.id)<($4::timestamptz,$5::uuid)":""}
      ORDER BY s.received_at DESC,s.id DESC LIMIT 51`,cursor?[projectId,access.team_id,wanted,cursor.time,cursor.id]:[projectId,access.team_id,wanted])).rows;
    const hasMore=rows.length>50,items=rows.slice(0,50),last=items.at(-1);
    const nextCursor=hasMore&&last?Buffer.from(JSON.stringify({project:projectId,status:wanted,time:last.cursorTime,id:last.sourceId})).toString("base64url"):null;
    for(const item of items)delete item.cursorTime;
    const counts=(await client.query<{status:string;count:string}>(`SELECT s.status,count(*) AS count FROM source_events s
      JOIN workspace_entity_map m ON m.entity_id=s.id AND m.entity_type='source_event' WHERE s.project_id=$1 AND s.team_id=$2 GROUP BY s.status`,[projectId,access.team_id])).rows;
    const iterations=(await client.query(`SELECT m.local_id AS id,i.title,i.state,i.outcome,i.change_summary AS body,
      a.body::jsonb->>'rationale' AS rationale,a.body::jsonb->>'nextStep' AS "nextStep",i.closed_at AS "closedAt",
      COALESCE(m.author_user_id=$2 OR m.imported_by=$2,false) AND $3::text IN ('student','student_lead') AS "canEdit"
      FROM iterations i JOIN workspace_entity_map m ON m.entity_id=i.id AND m.entity_type='iteration' AND m.project_id=i.project_id
      LEFT JOIN LATERAL (SELECT body FROM annotations WHERE entity_type='iteration' AND entity_id=i.id AND field='workspace_record' ORDER BY created_at DESC,id DESC LIMIT 1) a ON true
      WHERE i.project_id=$1 ORDER BY i.opened_at DESC,i.id DESC LIMIT 500`,[projectId,user.id,access.role])).rows;
    return {items,nextCursor,complete:!hasMore,role:access.role,revision:access.revision,counts:Object.fromEntries(counts.map(row=>[row.status,Number(row.count)])),iterations,pageSize:50};
  });
}
export async function manageWorkspaceInbox(user:WorkspaceUser,raw:unknown,options:{afterCanonicalWrite?:()=>void}={}){
  const input=inboxCommand.parse(raw);
  if(input.command==="triage")return executeWorkspaceCommand(user,{command:"triageSource",projectId:input.projectId,requestId:input.requestId,expectedRevision:input.expectedRevision,
    args:[{sourceId:input.sourceId,status:input.status,...(input.iterationId?{iterationId:input.iterationId}:{}),relationType:input.relationType}]},options);
  await workspaceTransaction(user,async client=>{
    const target=await client.query("SELECT 1 FROM workspace_entity_map WHERE project_id=$1 AND local_id=$2 AND entity_type='iteration'",[input.projectId,input.iterationId]);
    if(!target.rowCount)throw new WorkspaceError("invalid_fields",422,"Выберите существующую версию текущего проекта.");
  });
  // Route through ordinary author/version checks; no special closeout bypass.
  try{return await executeWorkspaceCommand(user,{command:"updateRecord",projectId:input.projectId,requestId:input.requestId,expectedRevision:input.expectedRevision,
    args:[input.iterationId,{status:input.status,body:input.body,rationale:input.rationale,outcome:input.outcome,nextStep:input.nextStep}]},options);
  }catch(error){if(error instanceof Error && /^(Для завершённой версии|Статус версии|Итог версии|Следующий шаг|Описание записи|Обоснование)/u.test(error.message))
      throw new WorkspaceError("invalid_fields",422,error.message);throw error;}
}

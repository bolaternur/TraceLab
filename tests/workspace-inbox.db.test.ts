import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {Pool} from "pg";
import {createHmac,randomUUID} from "node:crypto";
import type {WorkspaceUser} from "@/server/workspace-service";
let workspace:typeof import("@/server/workspace-service"),inbox:typeof import("@/server/workspace-inbox-service");
describe.skipIf(process.env.RUN_WORKSPACE_INBOX_DB_TESTS!=="true" || !process.env.DATABASE_URL || !process.env.DATABASE_MIGRATION_URL)("Inbox and iteration closeout — isolated PostgreSQL/RLS",()=>{
  const admin=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
  const users:WorkspaceUser[]=Array.from({length:4},(_,i)=>({id:randomUUID(),displayName:"Inbox fixture "+i,locale:"en"}));const [lead,student,foreign,coach]=users;
  const teams:string[]=[];let team:string,project:string,iterationId:string,otherIteration:string,sourceId:string,sourceRecordId:string;
  const revision=async()=>(await workspace.getWorkspace(lead,{project})).projects.find(p=>p.id===project)!.serverRevision!;
  const record=async(user:WorkspaceUser,values:Record<string,unknown>)=>(await workspace.executeWorkspaceCommand(user,{command:"addRecord",projectId:project,expectedRevision:await revision(),requestId:randomUUID(),args:[values]})).result as string;
  beforeAll(async()=>{
    workspace=await import("@/server/workspace-service");inbox=await import("@/server/workspace-inbox-service");
    if(!(await admin.query<{db:string}>("SELECT current_database() AS db")).rows[0].db.startsWith("tracelab_unified_"))throw new Error("Use only the isolated tracelab_unified_* database.");
    for(const user of users){await admin.query("INSERT INTO users(id,email,password_hash,display_name,locale) VALUES($1,$2,'test-only',$3,'en')",[user.id,user.id+"@example.invalid",user.displayName]);await admin.query("INSERT INTO account_verification(user_id,verified_at) VALUES($1,now())",[user.id]);}
    for(const user of [lead,foreign]){const state=await workspace.executeWorkspaceCommand(user,{command:"createTeam",requestId:randomUUID(),args:[{name:"Inbox fixture",project:"Fixture",season:"2026",timezone:"UTC",program:"OTHER",locale:"en"}]});teams.push(state.team!.id);if(user===lead){team=state.team!.id;project=state.activeProjectId!;}}
    for(const user of [student,coach])await admin.query("INSERT INTO team_memberships(team_id,user_id,role) VALUES($1,$2,$3)",[team,user.id,user===coach?"coach":"student"]);
    iterationId=await record(lead,{kind:"iteration",title:"Lead iteration",body:"Added softer contact surface"});otherIteration=await record(student,{kind:"iteration",title:"Student iteration",body:"Original change"});
    const sources=await import("@/server/workspace-sources-service");const configured=await sources.manageWorkspaceSources(lead,{command:"create",projectId:project,requestId:randomUUID(),repository:"fixture/robot",label:"Inbox fixture"}) as {id:string;secret:string};
    const body=Buffer.from(JSON.stringify({repository:{full_name:"fixture/robot"},ref:"refs/heads/main",before:"a".repeat(40),after:"b".repeat(40),commits:Array.from({length:52},(_,i)=>({id:(i+1).toString(16).padStart(40,"0"),message:"Fixture source "+i,timestamp:"2026-10-20T10:00:00Z",author:{username:"external-fixture"}}))}));
    await sources.receiveGithubDelivery(configured.id,randomUUID(),"push","sha256="+createHmac("sha256",configured.secret).update(body).digest("hex"),body);
    const first=(await inbox.getWorkspaceInbox(lead,project)).items[0];sourceId=first.sourceId;sourceRecordId=first.recordId;
  },30000);
  afterAll(async()=>{for(const id of teams){await admin.query("DELETE FROM audit_events WHERE team_id=$1",[id]);await admin.query("DELETE FROM teams WHERE id=$1",[id]);}for(const user of users)await admin.query("DELETE FROM users WHERE id=$1",[user.id]);await admin.end();});
  it("pages all sources without gaps at identical timestamps, scopes cursor/filter and blocks foreign reads",async()=>{
    const first=await inbox.getWorkspaceInbox(lead,project);expect(first.items).toHaveLength(50);expect(first.complete).toBe(false);expect(first.counts.inbox).toBe(52);
    const next=await inbox.getWorkspaceInbox(lead,project,{cursor:first.nextCursor});expect(next.items).toHaveLength(2);expect(next.complete).toBe(true);expect(new Set([...first.items,...next.items].map(item=>item.sourceId)).size).toBe(52);
    await expect(inbox.getWorkspaceInbox(lead,project,{status:"linked",cursor:first.nextCursor})).rejects.toMatchObject({code:"invalid_cursor"});
    await expect(inbox.getWorkspaceInbox(foreign,project)).rejects.toMatchObject({code:"forbidden"});
  });
  it("assigns exact iteration with directed accepted link, replays safely and preserves source originals through ignore/restore",async()=>{
    const before=(await admin.query("SELECT title,summary,raw_metadata,content_hash,occurred_at FROM source_events WHERE id=$1",[sourceId])).rows[0];
    const cmd={command:"triage",projectId:project,requestId:randomUUID(),expectedRevision:await revision(),sourceId,status:"linked",iterationId,relationType:"DERIVED_FROM"};
    await inbox.manageWorkspaceInbox(lead,cmd);const replay=await inbox.manageWorkspaceInbox(lead,cmd);expect('replayed' in replay&&replay.replayed).toBe(true);
    const view=(await workspace.getWorkspace(lead,{project})).projects.find(p=>p.id===project)!;expect(view.links).toContainEqual(expect.objectContaining({from:iterationId,to:sourceRecordId,relationType:"DERIVED_FROM",status:"accepted"}));
    for(const status of ["ignored","inbox"])await inbox.manageWorkspaceInbox(student,{...cmd,status,requestId:randomUUID(),expectedRevision:await revision()});
    expect((await admin.query("SELECT title,summary,raw_metadata,content_hash,occurred_at FROM source_events WHERE id=$1",[sourceId])).rows[0]).toEqual(before);
    expect((await admin.query("SELECT iteration_id FROM source_events WHERE id=$1",[sourceId])).rows[0].iteration_id).toBeTruthy();
    await expect(inbox.manageWorkspaceInbox(coach,{...cmd,requestId:randomUUID(),expectedRevision:await revision()})).rejects.toMatchObject({code:"forbidden"});
    await expect(inbox.manageWorkspaceInbox(lead,{...cmd,iterationId:"foreign-or-missing",requestId:randomUUID(),expectedRevision:await revision()})).rejects.toMatchObject({code:"invalid_fields"});
  });
  it("rolls back triage status/link/revision when a later transaction step fails",async()=>{
    const before=await revision(),beforeLinkCount=(await workspace.getWorkspace(lead,{project})).projects.find(p=>p.id===project)!.links.length;
    await expect(inbox.manageWorkspaceInbox(lead,{command:"triage",projectId:project,requestId:randomUUID(),expectedRevision:before,sourceId,status:"linked",iterationId:otherIteration,relationType:"REFERENCES"},{afterCanonicalWrite:()=>{throw new Error("fixture rollback");}})).rejects.toThrow("fixture rollback");
    expect(await revision()).toBe(before);expect((await admin.query("SELECT status FROM source_events WHERE id=$1",[sourceId])).rows[0].status).toBe("inbox");expect((await workspace.getWorkspace(lead,{project})).projects.find(p=>p.id===project)!.links.length).toBe(beforeLinkCount);
  });
  it("requires author change/why/outcome to close, denies foreign authors, and retains close/reopen history",async()=>{
    const cmd={command:"iteration",projectId:project,requestId:randomUUID(),expectedRevision:await revision(),iterationId,status:"closed",body:"New softer contact surface",rationale:"",outcome:"kept",nextStep:"Repeat test"};
    await expect(inbox.manageWorkspaceInbox(lead,cmd)).rejects.toMatchObject({code:"invalid_fields"});
    await expect(inbox.manageWorkspaceInbox(student,{...cmd,rationale:"Not the author's why"})).rejects.toMatchObject({code:"forbidden"});
    await inbox.manageWorkspaceInbox(lead,{...cmd,rationale:"Original trials slipped; softer surface improves grip"});
    let canonical=(await admin.query("SELECT i.state,i.closed_at FROM iterations i JOIN workspace_entity_map m ON m.entity_id=i.id WHERE m.project_id=$1 AND m.local_id=$2",[project,iterationId])).rows[0];expect(canonical.state).toBe("closed");expect(canonical.closed_at).toBeTruthy();
    await inbox.manageWorkspaceInbox(lead,{...cmd,requestId:randomUUID(),expectedRevision:await revision(),status:"draft",rationale:"Original trials slipped; softer surface improves grip"});
    canonical=(await admin.query("SELECT i.state,i.closed_at FROM iterations i JOIN workspace_entity_map m ON m.entity_id=i.id WHERE m.project_id=$1 AND m.local_id=$2",[project,iterationId])).rows[0];expect(canonical.state).toBe("open");expect(canonical.closed_at).toBeNull();
    const current=(await workspace.getWorkspace(lead,{project})).projects.find(p=>p.id===project)!.records.find(r=>r.id===iterationId)!;
    expect(JSON.stringify(current.recordHistory)).toContain('"status":"closed"');expect(current.status).toBe("draft");
    expect((await inbox.getWorkspaceInbox(lead,project)).iterations.find(i=>i.id===otherIteration).canEdit).toBe(false);
  });
});

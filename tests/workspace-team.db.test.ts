import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {Pool} from "pg";
import {randomUUID} from "node:crypto";
import type {WorkspaceUser} from "@/server/workspace-service";
let workspace:typeof import("@/server/workspace-service");
let teamService:typeof import("@/server/workspace-team-service");
describe.skipIf(process.env.RUN_WORKSPACE_TEAM_DB_TESTS!=="true" || !process.env.DATABASE_URL || !process.env.DATABASE_MIGRATION_URL)("Team management — isolated PostgreSQL/RLS",()=>{
  const admin=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
  const users:WorkspaceUser[]=Array.from({length:5},(_,i)=>({id:randomUUID(),displayName:"Team setting fixture "+i,locale:"en"}));
  const [lead,student,foreign,coach,unverified]=users;const teams:string[]=[];let team:string,project:string;
  const command=(userId:string,role="student",status="active",expectedRole="student",expectedStatus="active")=>({command:"changeMember",teamId:team,userId,role,status,expectedRole,expectedStatus});
  beforeAll(async()=>{
    workspace=await import("@/server/workspace-service");teamService=await import("@/server/workspace-team-service");
    if(!(await admin.query<{db:string}>("SELECT current_database() AS db")).rows[0].db.startsWith("tracelab_unified_"))throw new Error("Only isolated tracelab_unified_* database allowed.");
    for(const user of users){await admin.query("INSERT INTO users(id,email,password_hash,display_name,locale) VALUES($1,$2,'test-only',$3,'en')",[user.id,user.id+"@example.invalid",user.displayName]);await admin.query("INSERT INTO account_verification(user_id,verified_at) VALUES($1,$2)",[user.id,user===unverified?null:new Date()]);}
    for(const user of [lead,foreign]){const state=await workspace.executeWorkspaceCommand(user,{command:"createTeam",requestId:randomUUID(),args:[{name:"Team fixture",project:"Fixture",season:"2026",timezone:"UTC",program:"OTHER",locale:"en"}]});teams.push(state.team!.id);if(user===lead){team=state.team!.id;project=state.activeProjectId!;}}
    for(const user of [student,coach,unverified])await admin.query("INSERT INTO team_memberships(team_id,user_id,role) VALUES($1,$2,$3)",[team,user.id,user===coach?"coach":"student"]);
  });
  afterAll(async()=>{for(const id of teams){await admin.query("DELETE FROM audit_events WHERE team_id=$1",[id]);await admin.query("DELETE FROM teams WHERE id=$1",[id]);}for(const user of users)await admin.query("DELETE FROM users WHERE id=$1",[user.id]);await admin.end();});
  it("lists scoped minimal member data and rejects foreign/unverified accounts",async()=>{
    const data=await teamService.getWorkspaceTeam(lead,team);expect(data.members).toHaveLength(4);expect(data.role).toBe("student_lead");expect(JSON.stringify(data.members)).not.toContain("@example.invalid");
    expect((await teamService.getWorkspaceTeam(student,team)).role).toBe("student");expect((await teamService.getWorkspaceTeam(coach,team)).role).toBe("coach");
    await expect(teamService.getWorkspaceTeam(foreign,team)).rejects.toMatchObject({code:"forbidden"});await expect(teamService.getWorkspaceTeam(unverified,team)).rejects.toMatchObject({code:"verification_required"});
  });
  it("updates versioned preferences, audits before/after and rejects stale/invalid/unprivileged changes",async()=>{
    const data=await teamService.getWorkspaceTeam(lead,team),input={command:"settings",teamId:team,name:"Changed fixture",timezone:"Asia/Qyzylorda",locale:"kk",expectedVersion:data.team.version};
    await teamService.manageWorkspaceTeam(lead,input);const changed=await teamService.getWorkspaceTeam(lead,team);expect(changed.team).toMatchObject({name:"Changed fixture",timezone:"Asia/Qyzylorda",locale:"kk",version:1});
    await expect(teamService.manageWorkspaceTeam(lead,input)).rejects.toMatchObject({code:"team_changed"});
    await expect(teamService.manageWorkspaceTeam(lead,{...input,expectedVersion:1,timezone:"Bad/Zone"})).rejects.toMatchObject({code:"invalid_fields"});
    for(const user of [student,coach,foreign])await expect(teamService.manageWorkspaceTeam(user,{...input,expectedVersion:1})).rejects.toMatchObject({code:"forbidden"});
    const audit=(await admin.query("SELECT metadata FROM audit_events WHERE team_id=$1 AND action='team.settings.changed'",[team])).rows;expect(audit).toHaveLength(1);expect(audit[0].metadata.before.timezone).toBe("UTC");expect(audit[0].metadata.after.timezone).toBe("Asia/Qyzylorda");
  });
  it("cannot self-promote as student/coach or appoint/change/remove a trusted adult role",async()=>{
    for(const actor of [student,coach])await expect(teamService.manageWorkspaceTeam(actor,command(actor.id,"student_lead"))).rejects.toMatchObject({code:"forbidden"});
    for(const target of [lead,student])await expect(teamService.manageWorkspaceTeam(lead,command(target.id,"coach"))).rejects.toBeDefined();
    await expect(teamService.manageWorkspaceTeam(lead,command(coach.id,"student","removed","coach"))).rejects.toMatchObject({code:"forbidden"});
    await expect(workspace.workspaceTransaction(lead,client=>client.query("SELECT public.workspace_manage_member($1,$2,'coach','active','student','active')",[team,student.id]))).rejects.toMatchObject({code:"22023"});
    await teamService.manageWorkspaceTeam(lead,command(student.id,"student_lead"));
    await expect(teamService.manageWorkspaceTeam(lead,command(student.id,"student"))).rejects.toMatchObject({code:"team_changed"});
    await teamService.manageWorkspaceTeam(lead,command(student.id,"student","active","student_lead"));
  });
  it("revokes next access while retaining authorship, then explicitly restores student access",async()=>{
    const state=await workspace.getWorkspace(student,{project}),before=state.projects.find(p=>p.id===project)!;
    const record=await workspace.executeWorkspaceCommand(student,{command:"addRecord",projectId:project,expectedRevision:before.serverRevision,requestId:randomUUID(),args:[{kind:"source",title:"Authorship must survive removal",body:"Fixture"}]});
    await teamService.manageWorkspaceTeam(lead,command(student.id,"student","removed"));await expect(workspace.getWorkspace(student,{project})).rejects.toMatchObject({code:"forbidden"});
    const source=(await admin.query("SELECT s.actor_user_id FROM source_events s JOIN workspace_entity_map m ON m.entity_id=s.id WHERE m.project_id=$1 AND m.local_id=$2",[project,record.result])).rows[0];expect(source.actor_user_id).toBe(student.id);
    await teamService.manageWorkspaceTeam(lead,command(student.id,"student","active","student","removed"));expect((await workspace.getWorkspace(student,{project})).team!.id).toBe(team);
  });
  it("shows no invitation token, revokes once and prevents subsequent acceptance",async()=>{
    const invite=await workspace.executeWorkspaceCommand(lead,{command:"createInvite",teamId:team,requestId:randomUUID(),args:[{email:student.id+"@example.invalid"}]},{origin:"http://localhost:3000"});
    const token=new URL((invite.result as {inviteUrl:string}).inviteUrl).searchParams.get("invite");const listed=await teamService.getWorkspaceTeam(lead,team),id=listed.invites[0].id;
    expect(JSON.stringify(listed)).not.toContain(token);expect((await teamService.getWorkspaceTeam(student,team)).invites).toHaveLength(0);
    await expect(teamService.manageWorkspaceTeam(student,{command:"revokeInvite",teamId:team,inviteId:id})).rejects.toMatchObject({code:"forbidden"});
    await teamService.manageWorkspaceTeam(lead,{command:"revokeInvite",teamId:team,inviteId:id});await teamService.manageWorkspaceTeam(lead,{command:"revokeInvite",teamId:team,inviteId:id});
    await expect(workspace.executeWorkspaceCommand(student,{command:"joinInvite",requestId:randomUUID(),args:[{token}]})).rejects.toBeDefined();
    expect((await admin.query("SELECT 1 FROM audit_events WHERE team_id=$1 AND action='team.invite.revoked'",[team])).rowCount).toBe(1);
  });
  it("serializes concurrent demotion and never removes the last active lead",async()=>{
    await expect(teamService.manageWorkspaceTeam(lead,command(lead.id,"student","removed","student_lead"))).rejects.toMatchObject({code:"last_lead"});
    await teamService.manageWorkspaceTeam(lead,command(student.id,"student_lead"));
    const results=await Promise.allSettled([teamService.manageWorkspaceTeam(lead,command(lead.id,"student","active","student_lead")),teamService.manageWorkspaceTeam(student,command(student.id,"student","active","student_lead"))]);
    expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);
    expect(Number((await admin.query<{count:string}>("SELECT count(*) FROM team_memberships WHERE team_id=$1 AND role='student_lead' AND status='active'",[team])).rows[0].count)).toBe(1);
    expect((await admin.query(`SELECT p.proname FROM pg_proc p,LATERAL aclexplode(p.proacl) a WHERE p.proname IN ('workspace_manage_member','workspace_update_team') AND a.grantee=0 AND a.privilege_type='EXECUTE'`)).rowCount).toBe(0);
  });
});

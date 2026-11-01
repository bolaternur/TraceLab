import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {Pool} from "pg";
import {randomUUID} from "node:crypto";
import type {WorkspaceUser} from "@/server/workspace-service";

describe.skipIf(process.env.RUN_WORKSPACE_HANDOFF_DB_TESTS!=="true"||!process.env.DATABASE_URL||!process.env.DATABASE_MIGRATION_URL)("season transition — disposable PostgreSQL only",()=>{
  const admin=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
  const users:WorkspaceUser[]=Array.from({length:4},(_,i)=>({id:randomUUID(),displayName:"Season fixture "+i,locale:"en"}));
  const [lead,student,coach,foreign]=users,teams:string[]=[],profileId=randomUUID(),policyId=randomUUID(),profiles=[profileId];let checked=false,team:string,project:string,season:string;
  let workspace:typeof import("@/server/workspace-service"),handoff:typeof import("@/server/workspace-handoff-service");
  const revision=async()=>(await workspace.getWorkspace(lead,{project})).projects.find(item=>item.id===project)!.serverRevision!;
  beforeAll(async()=>{
    const name=(await admin.query<{name:string}>("SELECT current_database() AS name")).rows[0].name;
    if(!/^tracelab_unified_test_[a-z0-9_]+$/.test(name))throw new Error("A fresh disposable database is required; development databases are forbidden.");checked=true;
    workspace=await import("@/server/workspace-service");handoff=await import("@/server/workspace-handoff-service");
    for(const user of users){await admin.query("INSERT INTO users(id,email,password_hash,display_name,locale) VALUES($1,$2,'fixture-only',$3,'en')",[user.id,user.id+"@example.invalid",user.displayName]);await admin.query("INSERT INTO account_verification(user_id,verified_at) VALUES($1,now())",[user.id]);}
    for(const user of [lead,foreign]){const created=await workspace.executeWorkspaceCommand(user,{command:"createTeam",requestId:randomUUID(),args:[{name:"Season fixture",project:"Original robot",season:"2026",timezone:"UTC",program:"OTHER",locale:"en"}]});teams.push(created.team!.id);if(user===lead){team=created.team!.id;project=created.activeProjectId!;}}
    season=(await handoff.getWorkspaceHandoff(lead,project)).season.id;await admin.query("UPDATE seasons SET year=2026 WHERE id=$1",[season]);
    for(const user of [student,coach])await admin.query("INSERT INTO team_memberships(team_id,user_id,role) VALUES($1,$2,$3)",[team,user.id,user===coach?"coach":"student"]);
    await workspace.executeWorkspaceCommand(lead,{command:"addRecord",projectId:project,expectedRevision:await revision(),requestId:randomUUID(),args:[{kind:"iteration",title:"Original change",body:"Original source",subsystem:"Intake fixture",rationale:"Student's original reason"}]});
    await admin.query("INSERT INTO competition_profiles(id,key,program,name) VALUES($1,$2,'OTHER','Fixture rules')",[profileId,"handoff-fixture-"+profileId]);
    await admin.query(`INSERT INTO policy_versions(id,profile_id,version,status,effective_from,reviewed_at,reviewer,source_urls,constraints,action_matrix)
      VALUES($1,$2,'fixture-old','active',now()-interval '1 day',now(),'Fixture reviewer','["https://example.invalid/fixture"]',$3::jsonb,'{"export_deterministic_notebook":"ALLOW"}')`,[policyId,profileId,JSON.stringify({season:"2026",maxPages:20,maxFileMb:15,validUntil:new Date(Date.now()+86400000).toISOString()})]);
    await admin.query("UPDATE teams SET competition_profile_id=$1 WHERE id=$2",[profileId,team]);
  },30000);
  afterAll(async()=>{try{if(checked){for(const id of teams){await admin.query("DELETE FROM audit_events WHERE team_id=$1",[id]);await admin.query("DELETE FROM teams WHERE id=$1",[id]);}for(const id of profiles)await admin.query("DELETE FROM competition_profiles WHERE id=$1",[id]);for(const user of users)await admin.query("DELETE FROM users WHERE id=$1",[user.id]);}}finally{await admin.end();}});
  it("requires lead, acknowledgement, current season and exact revision; rolls all writes back on failure",async()=>{
    const cmd={projectId:project,expectedSeasonId:season,expectedProjectRevision:await revision(),requestId:randomUUID(),seasonName:"2027",year:2027,projectName:"Next robot",carrySubsystems:true,acknowledge:true};
    for(const user of [student,coach,foreign])await expect(handoff.startWorkspaceSeason(user,cmd)).rejects.toMatchObject({code:"forbidden"});
    await expect(handoff.startWorkspaceSeason(lead,{...cmd,acknowledge:false})).rejects.toThrow();
    await expect(handoff.startWorkspaceSeason(lead,{...cmd,expectedProjectRevision:cmd.expectedProjectRevision+1})).rejects.toMatchObject({code:"revision_conflict"});
    await expect(handoff.startWorkspaceSeason(lead,{...cmd,expectedSeasonId:randomUUID()})).rejects.toMatchObject({code:"season_state_changed"});
    await expect(handoff.startWorkspaceSeason(lead,{...cmd,year:2026})).rejects.toMatchObject({code:"invalid_fields"});
    await expect(handoff.startWorkspaceSeason(lead,cmd,{afterCanonicalWrite:()=>{throw new Error("fixture rollback");}})).rejects.toThrow("fixture rollback");
    const rows=(await admin.query("SELECT id,is_active,handoff_curated FROM seasons WHERE team_id=$1",[team])).rows;expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({id:season,is_active:true,handoff_curated:{}});
    expect((await admin.query("SELECT id FROM projects WHERE team_id=$1",[team])).rowCount).toBe(1);
  });
  it("creates one empty season on replay, preserves old evidence and pins old rules without inheriting them",async()=>{
    const before=(await workspace.getWorkspace(lead,{project})).projects.find(item=>item.id===project)!;
    const originals=(await admin.query("SELECT id,title,summary,raw_metadata,content_hash,occurred_at FROM source_events WHERE project_id=$1 ORDER BY id",[project])).rows;
    const cmd={projectId:project,expectedSeasonId:season,expectedProjectRevision:await revision(),requestId:randomUUID(),seasonName:"2027",year:2027,projectName:"Next robot",carrySubsystems:true,acknowledge:true};
    const [one,two]=await Promise.all([handoff.startWorkspaceSeason(lead,cmd),handoff.startWorkspaceSeason(lead,cmd)]),nextId=String(one.projectId);expect(two.projectId).toBe(nextId);expect([one.replayed,two.replayed].sort()).toEqual([false,true]);
    const next=(await workspace.getWorkspace(lead,{project:nextId})).projects.find(item=>item.id===nextId)!;expect(next.records).toEqual([]);expect(next.links).toEqual([]);
    const after=(await workspace.getWorkspace(lead,{project})).projects.find(item=>item.id===project)!;expect(after.records).toEqual(before.records);expect(after.links).toEqual(before.links);expect(after.serverRevision).toBe(before.serverRevision);
    expect((await admin.query("SELECT id,title,summary,raw_metadata,content_hash,occurred_at FROM source_events WHERE project_id=$1 ORDER BY id",[project])).rows).toEqual(originals);
    expect((await admin.query("SELECT name FROM subsystems WHERE project_id=$1",[nextId])).rows).toEqual([{name:"Intake fixture"}]);
    expect((await admin.query("SELECT count(*) AS count FROM artifacts a JOIN source_events s ON s.id=a.source_event_id WHERE s.project_id=$1",[nextId])).rows[0].count).toBe("0");
    const old=(await admin.query("SELECT is_active,handoff_curated FROM seasons WHERE id=$1",[season])).rows[0],fresh=(await handoff.getWorkspaceHandoff(lead,nextId));expect(old.is_active).toBe(false);expect(old.handoff_curated.izneraPolicyAnchor.versionId).toBe(policyId);expect(fresh.season.active).toBe(true);
    const newAnchor=(await admin.query("SELECT handoff_curated FROM seasons WHERE id=$1",[fresh.season.id])).rows[0].handoff_curated.izneraPolicyAnchor;expect(newAnchor.versionId).toBeNull();
    // A later team-level policy must neither replace old-season rules nor approve the new season.
    const nextProfile=randomUUID();profiles.push(nextProfile);await admin.query("INSERT INTO competition_profiles(id,key,program,name) VALUES($1,$2,'OTHER','Next fixture rules')",[nextProfile,"handoff-fixture-"+nextProfile]);
    await admin.query(`INSERT INTO policy_versions(profile_id,version,status,constraints) VALUES($1,'fixture-new','active','{"season":"2027"}')`,[nextProfile]);await admin.query("UPDATE teams SET competition_profile_id=$1 WHERE id=$2",[nextProfile,team]);
    const {previewWorkspaceReport}=await import("@/server/workspace-report-service");expect((await previewWorkspaceReport(lead,project)).policyGate.policy?.id).toBe(policyId);expect((await previewWorkspaceReport(lead,nextId)).policyGate.policy).toBeNull();expect((await previewWorkspaceReport(lead,nextId)).policyGate.allowed).toBe(false);
    await expect(handoff.startWorkspaceSeason(lead,{...cmd,projectName:"Changed payload"})).rejects.toMatchObject({code:"idempotency_conflict"});
    await expect(handoff.startWorkspaceSeason(lead,{...cmd,requestId:randomUUID()})).rejects.toMatchObject({code:"season_state_changed"});
    expect((await admin.query("SELECT id FROM seasons WHERE team_id=$1",[team])).rowCount).toBe(2);
  });
});

import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {Pool} from "pg";
import {randomUUID} from "node:crypto";
import type {WorkspaceUser} from "@/server/workspace-service";
let workspace:typeof import("@/server/workspace-service"),teamService:typeof import("@/server/workspace-team-service");
const configured=process.env.RUN_WORKSPACE_INVITES_DB_TESTS==="true"&&Boolean(process.env.DATABASE_URL&&process.env.DATABASE_MIGRATION_URL);
describe.skipIf(!configured)("Reusable team codes — isolated PostgreSQL/RLS",()=>{
  const admin=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
  const users:WorkspaceUser[]=Array.from({length:9},(_,index)=>({id:randomUUID(),displayName:"Team code fixture "+index,locale:"en"}));
  const [lead,memberOne,memberTwo,outsider,otherLead,coach,unverified,removed,racing]=users;
  const teams:string[]=[];let team:string,project:string,otherTeam:string;
  type Invite={inviteId:string;inviteCode:string;inviteUrl:string;maxUses:number;expiresAt:string;kind:string};
  const cmd=(command:string,args:unknown[],extra={})=>({command,args,requestId:randomUUID(),...extra});
  const create=async(options:Record<string,unknown>={})=>(await workspace.executeWorkspaceCommand(lead,cmd("createInvite",[{kind:"team_code",...options}],{teamId:team}),{origin:"http://localhost:3000"})).result as Invite;
  const join=(user:WorkspaceUser,token:string)=>workspace.executeWorkspaceCommand(user,cmd("joinInvite",[{token}]));
  let shared:Invite;
  beforeAll(async()=>{
    workspace=await import("@/server/workspace-service");teamService=await import("@/server/workspace-team-service");
    if(!(await admin.query<{name:string}>("SELECT current_database() AS name")).rows[0].name.startsWith("tracelab_unified_"))throw new Error("Use the isolated tracelab_unified_* database.");
    for(const user of users){await admin.query("INSERT INTO users(id,email,password_hash,display_name,locale) VALUES($1,$2,'test-only',$3,'en')",[user.id,user.id+"@example.invalid",user.displayName]);await admin.query("INSERT INTO account_verification(user_id,verified_at) VALUES($1,$2)",[user.id,user===unverified?null:new Date()]);}
    for(const user of [lead,otherLead]){const state=await workspace.executeWorkspaceCommand(user,cmd("createTeam",[{name:"Code fixture",project:"Robot mechanism",season:"2026",timezone:"UTC",program:"OTHER",locale:"en"}]));teams.push(state.team!.id);if(user===lead){team=state.team!.id;project=state.activeProjectId!;}else otherTeam=state.team!.id;}
    await admin.query("INSERT INTO team_memberships(team_id,user_id,role,status) VALUES($1,$2,'coach','active'),($1,$3,'student','removed')",[team,coach.id,removed.id]);
  });
  afterAll(async()=>{for(const id of teams){await admin.query("DELETE FROM audit_events WHERE team_id=$1",[id]);await admin.query("DELETE FROM teams WHERE id=$1",[id]);}for(const user of users)await admin.query("DELETE FROM users WHERE id=$1",[user.id]);await admin.end();});
  it("creates a distinct reusable code, retains only its hash/encrypted retry receipt, and returns the same code on lost-response retry",async()=>{
    const request=cmd("createInvite",[{kind:"team_code"}],{teamId:team});
    const response=await workspace.executeWorkspaceCommand(lead,request,{origin:"http://localhost:3000"});shared=response.result as Invite;
    expect(shared).toMatchObject({kind:"team_code",maxUses:50});expect(shared.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){2}$/);
    expect(shared.inviteUrl).toBe("http://localhost:3000/join/"+shared.inviteCode);
    const replay=await workspace.executeWorkspaceCommand(lead,request,{origin:"http://localhost:3000"});expect("replayed" in replay&&replay.replayed).toBe(true);expect(replay.result).toEqual(shared);
    const invite=(await admin.query("SELECT * FROM team_invites WHERE id=$1",[shared.inviteId])).rows[0];expect(invite.code).toMatch(/^[a-f0-9]{64}$/);expect(invite.kind).toBe("team_code");
    const receipt=JSON.stringify((await admin.query("SELECT result FROM workspace_requests WHERE user_id=$1 AND request_id=$2",[lead.id,request.requestId])).rows[0]);
    expect(receipt).toContain("encryptedInviteResult");expect(receipt).not.toContain(shared.inviteCode);expect(receipt).not.toContain(shared.inviteUrl);
    const list=await teamService.getWorkspaceTeam(lead,team);expect(list.invites.find(item=>item.id===shared.inviteId).kind).toBe("team_code");expect(JSON.stringify(list)).not.toContain(shared.inviteCode);
    const second=await create();expect(second.inviteCode).not.toBe(shared.inviteCode);await teamService.manageWorkspaceTeam(lead,{command:"revokeInvite",teamId:team,inviteId:second.inviteId});
  });
  it("lets two separate accounts share the exact team/project and each other's authored records while a third team is isolated",async()=>{
    await expect(workspace.getWorkspace(memberOne,{team,project})).rejects.toMatchObject({status:403});
    const one=await join(memberOne,shared.inviteCode.toLowerCase().replaceAll("-"," ")),two=await join(memberTwo,shared.inviteCode);
    expect(one.team!.id).toBe(team);expect(two.activeProjectId).toBe(project);expect(one.role).toBe("student");expect(two.role).toBe("student");
    const a=await workspace.executeWorkspaceCommand(memberOne,cmd("addRecord",[{kind:"source",title:"Photo observation by member one",body:"Test-only team collaboration fixture"}],{projectId:project,expectedRevision:0}));
    const b=await workspace.executeWorkspaceCommand(memberTwo,cmd("addRecord",[{kind:"test",title:"Test by member two",body:"Fixture",trials:10,successes:7}],{projectId:project,expectedRevision:a.projects[0].serverRevision}));
    const reloaded=await workspace.getWorkspace(memberOne,{project});expect(reloaded.projects[0].records.map(record=>record.title)).toEqual(expect.arrayContaining(["Photo observation by member one","Test by member two"]));
    expect(b.projects[0].records.find(record=>record.title==="Photo observation by member one")!.author).toBe(memberOne.displayName);
    await expect(workspace.getWorkspace(otherLead,{team,project})).rejects.toMatchObject({status:403});
    await expect(workspace.getWorkspace(memberOne,{team:otherTeam})).rejects.toMatchObject({status:403});
    expect((await teamService.getWorkspaceTeam(memberOne,team)).invites).toHaveLength(0);
  });
  it("prevents students/coaches/unverified accounts from creating codes, joining as an adult or reviving removed membership",async()=>{
    for(const user of [memberOne,coach])await expect(workspace.executeWorkspaceCommand(user,cmd("createInvite",[{kind:"team_code"}],{teamId:team}))).rejects.toMatchObject({status:403});
    await expect(workspace.executeWorkspaceCommand(lead,cmd("createInvite",[{kind:"team_code",role:"coach"}],{teamId:team}))).rejects.toBeDefined();
    await expect(join(unverified,shared.inviteCode)).rejects.toMatchObject({code:"verification_required"});
    await expect(join(removed,shared.inviteCode)).rejects.toMatchObject({code:"invite_unavailable"});
    await expect(workspace.workspaceTransaction(coach,client=>client.query("INSERT INTO team_invites(team_id,code,kind,role,max_uses,expires_at,created_by) VALUES($1,$2,'team_code','student',50,now()+interval '1 day',$3)",[team,randomUUID(),coach.id]))).rejects.toMatchObject({code:"42501"});
    await expect(workspace.workspaceTransaction(memberOne,client=>client.query("UPDATE team_invites SET revoked_at=now() WHERE id=$1 RETURNING id",[shared.inviteId]))).resolves.toMatchObject({rowCount:0});
  });
  it("counts distinct joiners only and serializes competing joins at the last seat",async()=>{
    const invite=await create({maxUses:2});await join(memberOne,invite.inviteCode);
    expect((await admin.query("SELECT uses FROM team_invites WHERE id=$1",[invite.inviteId])).rows[0].uses).toBe(0);
    await admin.query("UPDATE team_invites SET uses=1 WHERE id=$1",[invite.inviteId]);
    const results=await Promise.allSettled([join(outsider,invite.inviteCode),join(racing,invite.inviteCode)]);
    expect(results.filter(result=>result.status==="fulfilled")).toHaveLength(1);expect(results.filter(result=>result.status==="rejected")).toHaveLength(1);
    const winner=results[0].status==="fulfilled"?outsider:racing;await join(winner,invite.inviteCode);
    expect((await admin.query("SELECT uses FROM team_invites WHERE id=$1",[invite.inviteId])).rows[0].uses).toBe(2);
    await teamService.manageWorkspaceTeam(lead,{command:"revokeInvite",teamId:team,inviteId:invite.inviteId});
  });
  it("rejects revoked/expired/unknown codes, retains original membership and caps active codes",async()=>{
    const revoked=await create();await teamService.manageWorkspaceTeam(lead,{command:"revokeInvite",teamId:team,inviteId:revoked.inviteId});await expect(join(memberOne,revoked.inviteCode)).rejects.toMatchObject({code:"invite_unavailable"});
    const expired=await create();await admin.query("UPDATE team_invites SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.inviteId]);await expect(join(memberOne,expired.inviteCode)).rejects.toMatchObject({code:"invite_unavailable"});
    await expect(join(memberOne,"AAAA-BBBB-CCCC")).rejects.toMatchObject({code:"invite_unavailable"});
    for(let index=0;index<4;index++)await create();await expect(create()).rejects.toMatchObject({code:"invite_limit"});
    expect((await workspace.getWorkspace(memberOne,{team})).role).toBe("student");
  });
  it("keeps failed-code attempts outside rollback and blocks repeated guessing even with the same request ID",async()=>{
    const request=cmd("joinInvite",[{token:"AAAA-BBBB-CCCC"}]);let rateLimited=false;
    for(let attempt=0;attempt<21;attempt++){
      try{await workspace.executeWorkspaceCommand(outsider,request);throw new Error("An unknown code must never join a team");}
      catch(error){expect(error).toHaveProperty("code");const code=String((error as {code:string}).code);expect(["invite_unavailable","rate_limited"]).toContain(code);if(code==="rate_limited"){rateLimited=true;expect(error).toMatchObject({status:429});}}
    }
    expect(rateLimited).toBe(true);
    expect((await admin.query("SELECT 1 FROM workspace_requests WHERE user_id=$1 AND request_id=$2",[outsider.id,request.requestId])).rowCount).toBe(0);
  });
});

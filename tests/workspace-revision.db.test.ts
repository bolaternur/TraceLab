import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {Pool} from "pg";
import {randomUUID} from "node:crypto";
import type {WorkspaceUser} from "@/server/workspace-service";
let workspace:typeof import("@/server/workspace-service"),revisions:typeof import("@/server/workspace-revision-service");
describe.skipIf(process.env.RUN_WORKSPACE_REVISION_DB_TESTS!=="true"||!process.env.DATABASE_URL||!process.env.DATABASE_MIGRATION_URL)("Private team revision polling",()=>{
  const admin=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
  const users:WorkspaceUser[]=Array.from({length:3},(_,index)=>({id:randomUUID(),displayName:`Revision fixture ${index}`,locale:'ru'}));
  const [lead,member,outsider]=users;let teamId:string,projectId:string;
  beforeAll(async()=>{
    workspace=await import("@/server/workspace-service");revisions=await import("@/server/workspace-revision-service");
    const name=(await admin.query<{name:string}>('SELECT current_database() AS name')).rows[0].name;
    if(!name.startsWith('tracelab_unified_'))throw new Error('Use only the isolated development/test database.');
    for(const user of users){await admin.query("INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,'test-only',$3)",[user.id,user.id+'@example.invalid',user.displayName]);await admin.query('INSERT INTO account_verification(user_id,verified_at) VALUES($1,now())',[user.id]);}
    const created=await workspace.executeWorkspaceCommand(lead,{command:'createTeam',requestId:randomUUID(),args:[{name:'Revision fixture',project:'Fixture',season:'2026',timezone:'Asia/Qyzylorda',program:'OTHER',locale:'ru'}]});
    teamId=created.team!.id;projectId=created.activeProjectId!;
    await admin.query("INSERT INTO team_memberships(team_id,user_id,role) VALUES($1,$2,'student')",[teamId,member.id]);
  });
  afterAll(async()=>{
    if(teamId){await admin.query('DELETE FROM audit_events WHERE team_id=$1',[teamId]);await admin.query('DELETE FROM teams WHERE id=$1',[teamId]);}
    for(const user of users)await admin.query('DELETE FROM users WHERE id=$1',[user.id]);await admin.end();
  });
  it('exposes only private revision metadata and updates it after another member saves',async()=>{
    const before=await revisions.getWorkspaceRevision(member,teamId);expect(before.projects).toEqual([{id:projectId,serverRevision:0}]);
    expect(JSON.stringify(before)).not.toContain('records');
    await workspace.executeWorkspaceCommand(lead,{command:'addRecord',projectId,requestId:randomUUID(),expectedRevision:0,args:[{kind:'source',title:'Private evidence fixture',body:'Another team must not see this'}]});
    const after=await revisions.getWorkspaceRevision(member,teamId);expect(after.projects[0].serverRevision).toBe(1);expect(JSON.stringify(after)).not.toContain('Private evidence fixture');
  });
  it('rejects foreign accounts and revoked memberships on the next poll',async()=>{
    await expect(revisions.getWorkspaceRevision(outsider,teamId)).rejects.toMatchObject({code:'forbidden'});
    await admin.query("UPDATE team_memberships SET status='removed',left_at=now() WHERE team_id=$1 AND user_id=$2",[teamId,member.id]);
    await expect(revisions.getWorkspaceRevision(member,teamId)).rejects.toMatchObject({code:'forbidden'});
  });
});

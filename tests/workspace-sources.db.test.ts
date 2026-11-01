import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {Pool} from "pg";
import {createHmac,randomUUID} from "node:crypto";
import type {WorkspaceUser} from "@/server/workspace-service";
let pool:typeof import("@/db").pool;
let executeWorkspaceCommand:typeof import("@/server/workspace-service").executeWorkspaceCommand;
let getWorkspace:typeof import("@/server/workspace-service").getWorkspace;
let workspaceTransaction:typeof import("@/server/workspace-service").workspaceTransaction;
let listWorkspaceSources:typeof import("@/server/workspace-sources-service").listWorkspaceSources;
let manageWorkspaceSources:typeof import("@/server/workspace-sources-service").manageWorkspaceSources;
let receiveGithubDelivery:typeof import("@/server/workspace-sources-service").receiveGithubDelivery;

describe.skipIf(process.env.RUN_WORKSPACE_SOURCES_DB_TESTS!=="true" || !process.env.DATABASE_URL || !process.env.DATABASE_MIGRATION_URL)("GitHub source receipts — isolated PostgreSQL/RLS",()=>{
  const admin=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
  const a:WorkspaceUser={id:randomUUID(),displayName:"Source test lead",locale:"en"},b:WorkspaceUser={id:randomUUID(),displayName:"Other test lead",locale:"en"};
  const teams:string[]=[];let project:string,team:string,foreignProject:string,connectionId:string,secret:string;
  const payload=(sha="b".repeat(40),timestamp="2026-10-20T12:00:00+05:00")=>Buffer.from(JSON.stringify({repository:{full_name:"test-team/robot"},ref:"refs/heads/main",before:"a".repeat(40),after:sha,deleted:false,forced:false,sender:{login:"external-dev",id:123},commits:[{id:sha,message:"Improve intake",timestamp,author:{username:"external-dev",email:"excluded@example.invalid"}}]}));
  const sign=(raw:Buffer,key=secret)=>"sha256="+createHmac("sha256",key).update(raw).digest("hex");
  const deliver=(raw:Buffer,id=randomUUID(),options={})=>receiveGithubDelivery(connectionId,id,"push",sign(raw),raw,options);
  beforeAll(async()=>{
    ({pool}=await import("@/db"));
    ({executeWorkspaceCommand,getWorkspace,workspaceTransaction}=await import("@/server/workspace-service"));
    ({listWorkspaceSources,manageWorkspaceSources,receiveGithubDelivery}=await import("@/server/workspace-sources-service"));
    if(!(await admin.query<{db:string}>("SELECT current_database() AS db")).rows[0].db.startsWith("tracelab_unified_"))throw new Error("Use only the isolated tracelab_unified_* database.");
    for(const user of [a,b]){
      await admin.query("INSERT INTO users(id,email,password_hash,display_name,locale) VALUES($1,$2,'test-only',$3,'en')",[user.id,user.id+"@example.invalid",user.displayName]);
      await admin.query("INSERT INTO account_verification(user_id,verified_at) VALUES($1,now())",[user.id]);
      const state=await executeWorkspaceCommand(user,{command:"createTeam",requestId:randomUUID(),args:[{name:user.displayName,project:"Source fixture",season:"Fixture",timezone:"UTC",program:"OTHER",locale:"en"}]});
      teams.push(state.team!.id);if(user===a){team=state.team!.id;project=state.activeProjectId!;}else foreignProject=state.activeProjectId!;
    }
  });
  afterAll(async()=>{for(const id of teams){await admin.query("DELETE FROM audit_events WHERE team_id=$1",[id]);await admin.query("DELETE FROM teams WHERE id=$1",[id]);}for(const user of [a,b])await admin.query("DELETE FROM users WHERE id=$1",[user.id]);await admin.end();});
  it("configures only scoped leads, encrypts the secret and never returns it in listings/replay",async()=>{
    const requestId=randomUUID(),command={command:"create",projectId:project,requestId,repository:"test-team/robot",label:"GitHub fixture"};
    const result=await manageWorkspaceSources(a,command) as {id:string;secret:string};connectionId=result.id;secret=result.secret;expect(secret).toHaveLength(64);
    const row=(await admin.query("SELECT status,encrypted_secret FROM source_connections WHERE id=$1",[connectionId])).rows[0];expect(row.status).toBe("pending");expect(row.encrypted_secret).not.toContain(secret);
    expect(JSON.stringify(await listWorkspaceSources(a,project))).not.toContain(secret);
    expect(await manageWorkspaceSources(a,command)).toMatchObject({id:connectionId,secret:null,replayed:true});
    await expect(manageWorkspaceSources(b,{...command,requestId:randomUUID()})).rejects.toMatchObject({code:"forbidden"});
    await expect(listWorkspaceSources(b,project)).rejects.toMatchObject({code:"forbidden"});
    expect((await listWorkspaceSources(b,foreignProject)).connections).toHaveLength(0);
  });
  it("rejects untrusted signatures before receipt creation; definer helpers have no public grant",async()=>{
    const body=payload();await expect(receiveGithubDelivery(connectionId,randomUUID(),"push","sha256="+"0".repeat(64),body)).rejects.toMatchObject({code:"invalid_signature"});
    expect((await admin.query("SELECT 1 FROM workspace_source_receipts WHERE connection_id=$1",[connectionId])).rowCount).toBe(0);
    const publicGrants=await admin.query(`SELECT p.proname FROM pg_proc p,LATERAL aclexplode(p.proacl) a
      WHERE p.proname IN ('workspace_github_credential','workspace_member_role','workspace_create_team','workspace_join_invite') AND a.grantee=0 AND a.privilege_type='EXECUTE'`);
    expect(publicGrants.rowCount).toBe(0);
  });
  it("atomically imports metadata and replay is idempotent with immutable external provenance",async()=>{
    const body=payload(),id=randomUUID();expect(await deliver(body,id)).toMatchObject({status:"complete",importedCount:1,replayed:false});expect(await deliver(body,id)).toMatchObject({replayed:true});
    await expect(deliver(payload("c".repeat(40)),id)).rejects.toMatchObject({code:"delivery_conflict"});
    expect(await deliver(body)).toMatchObject({importedCount:0});
    const rows=(await admin.query("SELECT * FROM source_events WHERE connection_id=$1",[connectionId])).rows;expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe("github");expect(rows[0].actor_user_id).toBeNull();expect(rows[0].actor_external_id).toBe("external-dev");expect(rows[0].status).toBe("inbox");
    expect(rows[0].raw_metadata).toMatchObject({sha:"b".repeat(40),branch:"refs/heads/main",repository:"test-team/robot",externalAuthorshipUnverified:true});
    expect(JSON.stringify(rows[0].raw_metadata)).not.toContain("excluded@example.invalid");
    expect(rows[0].occurred_at.toISOString()).toBe("2026-10-20T07:00:00.000Z");
    expect((await getWorkspace(a,{project})).projects.find(p=>p.id===project)!.records).toHaveLength(1);
    await expect(workspaceTransaction(a,client=>client.query("UPDATE source_events SET title='tamper' WHERE id=$1",[rows[0].id]))).rejects.toMatchObject({code:"23514"});
  });
  it("retains out-of-order timestamps and denies foreign receipt visibility",async()=>{
    await deliver(payload("c".repeat(40),"2026-09-01T10:00:00Z"));
    const records=(await getWorkspace(a,{project})).projects.find(p=>p.id===project)!.records;
    expect(records.some(r=>r.createdAt==="2026-09-01T10:00:00.000Z")).toBe(true);
    await workspaceTransaction(b,async client=>expect((await client.query("SELECT 1 FROM workspace_source_receipts WHERE team_id=$1",[team])).rowCount).toBe(0));
    expect((await pool.query("SELECT 1 FROM workspace_source_receipts WHERE team_id=$1",[team])).rowCount).toBe(0);
  });
  it("retains failed receipt while rolling back evidence, then explicit retry commits once",async()=>{
    const id=randomUUID(),body=payload("d".repeat(40));
    const before=(await getWorkspace(a,{project})).projects.find(p=>p.id===project)!;
    await expect(deliver(body,id,{afterSource:()=>{throw new Error("fixture injected rollback");}})).rejects.toMatchObject({code:"ingestion_failed"});
    expect((await getWorkspace(a,{project})).projects.find(p=>p.id===project)!.records).toHaveLength(before.records.length);
    expect((await admin.query("SELECT status,attempts FROM workspace_source_receipts WHERE connection_id=$1 AND delivery_id=$2",[connectionId,id])).rows[0]).toEqual({status:"failed",attempts:1});
    expect(await manageWorkspaceSources(a,{command:"retry",projectId:project,connectionId,deliveryId:id})).toMatchObject({status:"complete",importedCount:1});
    expect((await admin.query("SELECT status,attempts FROM workspace_source_receipts WHERE connection_id=$1 AND delivery_id=$2",[connectionId,id])).rows[0]).toEqual({status:"complete",attempts:2});
  });
  it("rotates/revokes credentials and membership revocation blocks the next delivery",async()=>{
    const old=secret,rotated=await manageWorkspaceSources(a,{command:"rotate",projectId:project,connectionId}) as {secret:string};secret=rotated.secret;
    const body=payload("e".repeat(40));await expect(receiveGithubDelivery(connectionId,randomUUID(),"push",sign(body,old),body)).rejects.toMatchObject({code:"invalid_signature"});
    await deliver(body);
    await admin.query("UPDATE team_memberships SET status='removed' WHERE team_id=$1 AND user_id=$2",[team,a.id]);
    await expect(deliver(payload("f".repeat(40)))).rejects.toMatchObject({code:"connection_unavailable"});
    await admin.query("UPDATE team_memberships SET status='active' WHERE team_id=$1 AND user_id=$2",[team,a.id]);
    await manageWorkspaceSources(a,{command:"disconnect",projectId:project,connectionId});await expect(deliver(body)).rejects.toMatchObject({code:"connection_unavailable"});
    expect((await admin.query("SELECT encrypted_secret FROM source_connections WHERE id=$1",[connectionId])).rows[0].encrypted_secret).toBeNull();
  });
});

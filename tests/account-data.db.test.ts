import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { Pool } from "pg";
import { randomBytes,randomUUID } from "node:crypto";
import { accountHash } from "@/server/account-contract";
import type { WorkspaceUser } from "@/server/workspace-service";

const enabled=process.env.RUN_ACCOUNT_DATA_DB_TESTS==="true"&&Boolean(process.env.DATABASE_URL&&process.env.DATABASE_MIGRATION_URL);
describe.skipIf(!enabled)("account snapshot — own data, RLS and bounded export",()=>{
  const admin=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL}),people:WorkspaceUser[]=Array.from({length:3},(_,index)=>({id:randomUUID(),displayName:"Account archive fixture "+index,locale:"en"}));
  const [author,peer,outsider]=people,sessionHash=accountHash(randomBytes(32).toString("base64url")),foreignSession=accountHash(randomBytes(32).toString("base64url"));
  const identity={userId:author.id,sessionHash},teams:string[]=[],extraAnnotations:string[]=[];let teamId:string,projectId:string,ownSourceId:string;
  let workspace:typeof import("@/server/workspace-service"),service:typeof import("@/server/account-data-service");
  const command=(user:WorkspaceUser,kind:string,args:unknown[],extra={})=>workspace.executeWorkspaceCommand(user,{command:kind,args,requestId:randomUUID(),...extra});
  beforeAll(async()=>{
    if(!/^(?:iznera_test_account_data_[0-9]+_[a-f0-9]{8}|tracelab_unified_test_[0-9]+_[a-f0-9]{8})$/.test((await admin.query("SELECT current_database() AS name")).rows[0].name))throw new Error("Use an isolated DB runner; existing databases are never fixture targets.");
    workspace=await import("@/server/workspace-service");service=await import("@/server/account-data-service");
    const runtimeRole=(await (await import("@/db")).pool.query("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0];
    if(runtimeRole.rolsuper||runtimeRole.rolbypassrls)throw new Error("RLS tests require a restricted runtime role.");
    for(const user of people){await admin.query("INSERT INTO users(id,email,password_hash,display_name) VALUES($1,$2,'NEVER-EXPORT-THIS-HASH',$3)",[user.id,`account-archive-${user.id}@example.test`,user.displayName]);await admin.query("INSERT INTO account_verification(user_id,verified_at) VALUES($1,now())",[user.id]);}
    await admin.query("INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour'),($3,$4,now()+interval '1 hour')",[sessionHash,author.id,foreignSession,outsider.id]);
    for(const user of [author,outsider]){const state=await command(user,"createTeam",[{name:"Account data fixture",project:"Archive fixture",season:"2026",timezone:"UTC",program:"OTHER",locale:"en"}]);teams.push(state.team!.id);if(user===author){teamId=state.team!.id;projectId=state.activeProjectId!;}else await command(user,"addRecord",[{kind:"source",title:"FOREIGN-TEAM-PRIVATE",body:"Never export outsider's content"}],{projectId:state.activeProjectId!,expectedRevision:0});}
    await admin.query("INSERT INTO team_memberships(team_id,user_id,role) VALUES($1,$2,'student')",[teamId,peer.id]);
    const own=await command(author,"addRecord",[{kind:"source",title:"MY-AUTHORED-SOURCE",body:"My original explanation"}],{projectId,expectedRevision:0});
    await command(peer,"addRecord",[{kind:"source",title:"PEER-PRIVATE-WORDS",body:"Peer authored this; not my archive"}],{projectId,expectedRevision:own.projects[0].serverRevision});
    ownSourceId=(await admin.query("SELECT id FROM source_events WHERE team_id=$1 AND actor_user_id=$2",[teamId,author.id])).rows[0].id;
    await admin.query("INSERT INTO artifacts(team_id,source_event_id,kind,storage_key,mime_type,size_bytes,sha256) VALUES($1,$2,'photo','private/NEVER-EXPORT-STORAGE-KEY','image/png',12,'fixture-hash')",[teamId,ownSourceId]);
    for(const user of [author,peer])await admin.query("INSERT INTO workspace_chat_messages(id,team_id,user_id,request_id,body,payload_hash) VALUES($1,$2,$3,$4,$5,'fixture')",[randomUUID(),teamId,user.id,randomUUID(),user===author?"MY-CHAT-TEXT":"PEER-CHAT-PRIVATE"]);
  });
  afterAll(async()=>{for(const team of teams){await admin.query("DELETE FROM audit_events WHERE team_id=$1",[team]);await admin.query("DELETE FROM teams WHERE id=$1",[team]);}for(const user of people){await admin.query("DELETE FROM account_rate_limits WHERE key_hash=$1",[accountHash("account-data:"+user.id)]);await admin.query("DELETE FROM users WHERE id=$1",[user.id]);}await admin.end();});
  it("includes complete scoped categories while excluding tokens, binaries, peers and other teams",async()=>{
    const archive=await service.exportAccountData(identity),text=JSON.stringify(archive);
    expect(archive.account.id).toBe(author.id);expect(archive.coverage.completeForIncludedCategories).toBe(true);expect(archive.coverage.binaryFilesIncluded).toBe(false);
    expect(text).toContain("MY-AUTHORED-SOURCE");expect(text).toContain("MY-CHAT-TEXT");expect(text).not.toMatch(/FOREIGN-TEAM-PRIVATE|PEER-PRIVATE-WORDS|PEER-CHAT-PRIVATE|NEVER-EXPORT-THIS-HASH|NEVER-EXPORT-STORAGE-KEY/);
    expect(text).not.toContain(sessionHash);expect(text).not.toContain(foreignSession);expect(archive.data.fileReferences).toHaveLength(1);
    const rawForeign=await workspace.workspaceTransaction(author,client=>client.query("SELECT id FROM source_events WHERE team_id=$1",[teams[1]]));expect(rawForeign.rowCount).toBe(0);
  });
  it("rejects guessed owner/session pairs and revoked/expired sessions before export",async()=>{
    await expect(service.exportAccountData({...identity,sessionHash:foreignSession})).rejects.toMatchObject({code:"unauthenticated"});
    await expect(service.exportAccountData({...identity,userId:outsider.id})).rejects.toMatchObject({code:"unauthenticated"});
  });
  it("removing team membership immediately excludes old team content on the next snapshot",async()=>{
    await admin.query("UPDATE team_memberships SET status='removed' WHERE team_id=$1 AND user_id=$2",[teamId,author.id]);
    try{const result=await service.exportAccountData(identity),text=JSON.stringify(result);expect(text).not.toMatch(/MY-AUTHORED-SOURCE|MY-CHAT-TEXT/);expect(result.data.annotations).toHaveLength(0);expect(result.data.fileReferences).toHaveLength(0);}
    finally{await admin.query("UPDATE team_memberships SET status='active' WHERE team_id=$1 AND user_id=$2",[teamId,author.id]);}
  });
  it("returns an explicit limit error instead of truncating authored history",async()=>{
    const rows=await admin.query("INSERT INTO annotations(team_id,entity_type,entity_id,field,author_user_id,body) SELECT $1,'source_event',$2,'fixture_over_limit',$3,'Fixture version' FROM generate_series(1,2001) RETURNING id",[teamId,ownSourceId,author.id]);extraAnnotations.push(...rows.rows.map(row=>row.id));
    try{await expect(service.exportAccountData(identity)).rejects.toMatchObject({code:"data_export_too_large",status:413});}
    finally{await admin.query("DELETE FROM annotations WHERE id=ANY($1::uuid[])",[extraAnnotations]);}
  });
  it("bounds repeated data downloads and refuses the account after current-session revocation",async()=>{
    await admin.query("UPDATE account_rate_limits SET attempts=8 WHERE key_hash=$1",[accountHash("account-data:"+author.id)]);await expect(service.exportAccountData(identity)).rejects.toMatchObject({code:"rate_limited"});
    await admin.query("DELETE FROM sessions WHERE id=$1",[sessionHash]);await expect(service.exportAccountData(identity)).rejects.toMatchObject({code:"unauthenticated"});
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import type { WorkspaceUser } from "@/server/workspace-service";

const configured=process.env.RUN_WORKSPACE_DB_TESTS === "true" && Boolean(process.env.DATABASE_URL && process.env.DATABASE_MIGRATION_URL);
describe.skipIf(!configured)("unified workspace — real PostgreSQL/RLS (needs isolated DATABASE_URL and DATABASE_MIGRATION_URL)",()=>{
  let pool: Pool;
  let executeWorkspaceCommand: typeof import("@/server/workspace-service").executeWorkspaceCommand;
  let getWorkspace: typeof import("@/server/workspace-service").getWorkspace;
  let workspaceTransaction: typeof import("@/server/workspace-service").workspaceTransaction;
  const owner=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
  const users:WorkspaceUser[]=Array.from({length:5},(_,index)=>({id:randomUUID(),displayName:"Workspace test "+index,locale:"en"}));
  const [a,b,c,unverified,coach]=users;
  const teams:string[]=[];
  let teamA:string,teamC:string,projectA:string,projectC:string;
  const request=(command:string,args:unknown[]=[],projectId?:string,expectedRevision?:number)=>({command,args,projectId,expectedRevision,requestId:randomUUID()});
  async function createTeam(user:WorkspaceUser,label:string){
    const data=await executeWorkspaceCommand(user,request("createTeam",[{name:label,season:"2026 test",project:"Isolated test",timezone:"UTC",program:"OTHER",locale:"en"}]));
    const teamId=data.team!.id,projectId=data.activeProjectId!;teams.push(teamId);return {teamId,projectId};
  }
  async function revise(user:WorkspaceUser,command:string,args:unknown[],projectId=projectA){
    const state=await getWorkspace(user,{project:projectId,team:projectId===projectA?teamA:teamC});
    return executeWorkspaceCommand(user,request(command,args,projectId,state.projects.find(item=>item.id===projectId)!.serverRevision));
  }
  beforeAll(async()=>{
    ({pool}=await import("@/db"));
    ({executeWorkspaceCommand,getWorkspace,workspaceTransaction}=await import("@/server/workspace-service"));
    const database=(await owner.query<{current_database:string}>("SELECT current_database()")).rows[0].current_database;
    if(!database.startsWith("tracelab_unified_"))throw new Error("Refusing tests outside isolated tracelab_unified_* database.");
    for(const [index,user] of users.entries()){
      await owner.query("INSERT INTO users(id,email,password_hash,display_name,locale) VALUES($1,$2,'test-only-not-a-password',$3,'en')",[user.id,user.id+"@example.invalid",user.displayName]);
      await owner.query("INSERT INTO account_verification(user_id,verified_at) VALUES($1,$2)",[user.id,index===3?null:new Date()]);
    }
    ({teamId:teamA,projectId:projectA}=await createTeam(a,"Isolation A"));
    ({teamId:teamC,projectId:projectC}=await createTeam(c,"Isolation C"));
    const invite=await executeWorkspaceCommand(a,{...request("createInvite",[{role:"member"}],projectA),teamId:teamA},{origin:"http://localhost:3000"});
    const token=new URL((invite.result as {inviteUrl:string}).inviteUrl).searchParams.get("invite");
    await executeWorkspaceCommand(b,request("joinInvite",[{token}]));
    await owner.query("INSERT INTO team_memberships(team_id,user_id,role) VALUES($1,$2,'coach')",[teamA,coach.id]);
  });
  afterAll(async()=>{
    // Remove only this suite's random fixtures; no owner projects are selected.
    for(const team of teams)await owner.query("DELETE FROM teams WHERE id=$1",[team]);
    for(const user of users)await owner.query("DELETE FROM users WHERE id=$1",[user.id]);
    await owner.end();
  });
  it("uses a non-owner NOBYPASSRLS role and leaves no pooled tenant context",async()=>{
    const role=(await pool.query<{rolsuper:boolean;rolbypassrls:boolean;owns:boolean}>(`SELECT r.rolsuper,r.rolbypassrls,c.relowner=r.oid AS owns
      FROM pg_roles r CROSS JOIN pg_class c WHERE r.rolname=current_user AND c.oid='source_events'::regclass`)).rows[0];
    expect(role).toEqual({rolsuper:false,rolbypassrls:false,owns:false});
    const outside=await pool.query("SELECT id FROM projects WHERE id=$1",[projectA]);expect(outside.rowCount).toBe(0);
    await workspaceTransaction(a,async client=>expect((await client.query("SELECT id FROM projects WHERE id=$1",[projectA])).rowCount).toBe(1));
    const context=(await pool.query<{value:string|null}>("SELECT current_setting('app.user_id',true) AS value")).rows[0].value;
    expect(context===null || context==="").toBe(true);
  });
  it("shares persisted records with invited teammate and denies foreign reads/writes",async()=>{
    const saved=await revise(a,"addRecord",[{kind:"source",title:"Real persisted source",body:"Original workshop note",author:"spoofed"}]);
    expect(saved.projects.find(p=>p.id===projectA)!.records[0].author).toBe(a.displayName);
    const shared=await getWorkspace(b,{team:teamA,project:projectA});
    expect(shared.projects.find(p=>p.id===projectA)!.records.some(record=>record.title==="Real persisted source")).toBe(true);
    await expect(getWorkspace(c,{team:teamA,project:projectA})).rejects.toMatchObject({status:403});
    await expect(executeWorkspaceCommand(c,request("addRecord",[{kind:"source",title:"intrusion"}],projectA,0))).rejects.toMatchObject({status:403});
    await workspaceTransaction(c,async client=>{
      expect((await client.query("SELECT id FROM source_events WHERE project_id=$1",[projectA])).rowCount).toBe(0);
      expect((await client.query("UPDATE projects SET name='intrusion' WHERE id=$1",[projectA])).rowCount).toBe(0);
    });
    expect((await getWorkspace(c,{team:teamC,project:projectC})).team!.id).toBe(teamC);
  });
  it("rejects unverified users, student invite escalation and foreign authorship edits",async()=>{
    await expect(getWorkspace(unverified)).rejects.toMatchObject({code:"verification_required"});
    await expect(executeWorkspaceCommand(b,request("createInvite",[{}],projectA))).rejects.toMatchObject({status:403});
    await expect(executeWorkspaceCommand(a,request("createInvite",[{role:"coach"}],projectA))).rejects.toBeDefined();
    const state=await getWorkspace(b,{team:teamA,project:projectA});
    const target=state.projects.find(p=>p.id===projectA)!.records[0];
    await expect(revise(b,"updateRecord",[target.id,{body:"overwrite another student"}])).rejects.toMatchObject({status:403});
  });
  it("idempotently creates canonical test and decision plus correctly directed support link",async()=>{
    const test=await revise(a,"addRecord",[{kind:"test",title:"Grip trial",body:"Measured",trials:20,successes:17,unit:"attempts",conditions:"180 g"}]);
    const testId=test.result as string,revision=test.projects.find(p=>p.id===projectA)!.serverRevision;
    const cmd=request("addRecord",[{kind:"decision",title:"Keep surface",body:"Keep",rationale:"17/20 supports the choice",relatedRecordId:testId}],projectA,revision);
    const first=await executeWorkspaceCommand(a,cmd);
    const replay=await executeWorkspaceCommand(a,cmd);
    expect(replay.result).toBe(first.result);expect("replayed" in replay && replay.replayed).toBe(true);
    await expect(executeWorkspaceCommand(a,{...cmd,args:[{kind:"source",title:"Different"}]})).rejects.toMatchObject({code:"idempotency_conflict",status:409});
    const canonical=(await owner.query(`SELECT r.from_type,r.to_type,r.relation_type FROM relations r
      JOIN workspace_entity_map m ON m.entity_id=r.to_id WHERE m.project_id=$1 AND m.local_id=$2`,[projectA,first.result])).rows;
    expect(canonical).toContainEqual({from_type:"test",to_type:"decision",relation_type:"SUPPORTS"});
    expect((await owner.query("SELECT id FROM tests WHERE project_id=$1",[projectA])).rowCount).toBe(1);
    expect((await owner.query("SELECT id FROM decisions WHERE project_id=$1",[projectA])).rowCount).toBe(1);
  });
  it("validates closed decision rationale and preserves originals with append-only annotation versions",async()=>{
    await expect(revise(a,"addRecord",[{kind:"decision",title:"No why",body:"Incomplete"}])).rejects.toThrow();
    const state=await getWorkspace(a,{team:teamA,project:projectA}),project=state.projects.find(p=>p.id===projectA)!;
    const record=project.records.find(item=>item.title==="Real persisted source")!;
    await revise(a,"updateRecord",[record.id,{body:"A later explanation"}]);
    const mapping=(await owner.query<{entity_id:string}>("SELECT entity_id FROM workspace_entity_map WHERE project_id=$1 AND local_id=$2",[projectA,record.id])).rows[0];
    expect((await owner.query<{summary:string}>("SELECT summary FROM source_events WHERE id=$1",[mapping.entity_id])).rows[0].summary).toBe("Original workshop note");
    const versions=await owner.query<{supersedes_id:string|null}>("SELECT supersedes_id FROM annotations WHERE entity_id=$1 AND field='workspace_record' ORDER BY created_at",[mapping.entity_id]);
    expect(versions.rowCount).toBe(2);expect(versions.rows[1].supersedes_id).toBeTruthy();
    await expect(workspaceTransaction(a,client=>client.query("UPDATE source_events SET summary='tamper' WHERE id=$1",[mapping.entity_id]))).rejects.toMatchObject({code:"23514"});
    const reloaded=await getWorkspace(a,{team:teamA,project:projectA});
    expect(reloaded.projects.find(p=>p.id===projectA)!.records.find(item=>item.id===record.id)!.body).toBe("A later explanation");
    const stale=request("updateRecord",[record.id,{body:"stale edit"}],projectA,project.serverRevision);
    await expect(executeWorkspaceCommand(a,stale)).rejects.toMatchObject({code:"revision_conflict",status:409});
    const afterConflict=await getWorkspace(a,{team:teamA,project:projectA});
    const draft=afterConflict.conflictDrafts!.find(item=>item.recordId===record.id)!;
    expect(draft.record.body).toBe('stale edit');
    expect(afterConflict.projects.find(p=>p.id===projectA)!.records.find(item=>item.id===record.id)!.body).toBe('A later explanation');
    await expect(executeWorkspaceCommand(a,stale)).rejects.toMatchObject({details:{draftId:draft.id}});
    expect((await getWorkspace(a,{team:teamA,project:projectA})).conflictDrafts!.filter(item=>item.recordId===record.id)).toHaveLength(1);
    expect((await getWorkspace(b,{team:teamA,project:projectA})).conflictDrafts).toEqual([]);
  });
  it("rolls back canonical rows, links, snapshots and revision when a later transaction step fails",async()=>{
    const before=await getWorkspace(a,{team:teamA,project:projectA}),project=before.projects.find(p=>p.id===projectA)!;
    const counts=async()=> (await owner.query(`SELECT (SELECT count(*) FROM source_events WHERE project_id=$1) AS sources,
      (SELECT count(*) FROM annotations WHERE entity_id=$1 AND field='workspace_snapshot') AS snapshots`,[projectA])).rows[0];
    const oldCounts=await counts();
    await expect(executeWorkspaceCommand(a,request("addRecord",[{kind:"source",title:"Will rollback",body:"Not committed"}],projectA,project.serverRevision),
      {afterCanonicalWrite:()=>{throw new Error("forced rollback");}})).rejects.toThrow("forced rollback");
    expect(await counts()).toEqual(oldCounts);
    const after=await getWorkspace(a,{team:teamA,project:projectA});
    expect(after.projects.find(p=>p.id===projectA)!.serverRevision).toBe(project.serverRevision);
    expect(after.projects.find(p=>p.id===projectA)!.records.some(item=>item.title==="Will rollback")).toBe(false);
  });
  it("imports only after bound preview, retains local IDs/educational lineage and safely replays confirmation",async()=>{
    const original={schemaVersion:1,project:{id:"OLD-PROJECT",name:"Educational transfer",description:"Not research",dataKind:"personal",educationalOrigin:true,
      records:[{id:"LOCAL-01",kind:"source",title:"Local source",body:"Original",author:"Original label",createdAt:"2026-09-01T10:00:00Z"}],links:[],studyRows:[],nodePositions:{"LOCAL-01":{x:14,y:27}}}};
    const text=JSON.stringify(original);
    const preview=await executeWorkspaceCommand(a,request("previewImport",[text],projectA));
    const previewId=(preview.result as {previewId:string}).previewId;
    await expect(executeWorkspaceCommand(a,request("importProject",[text.replace("Original label","Changed label"),{previewId}],projectA))).rejects.toMatchObject({code:"preview_expired"});
    const first=await executeWorkspaceCommand(a,request("importProject",[text,{previewId}],projectA));
    const again=await executeWorkspaceCommand(a,request("importProject",[text,{previewId}],projectA));
    expect(again.result).toBe(first.result);
    const imported=first.projects.find(p=>p.id===first.activeProjectId)!;
    expect(imported.educationalOrigin).toBe(true);expect(imported.records[0].id).toBe("LOCAL-01");expect(imported.records[0].originalAuthorLabel).toBe("Original label");
    expect(imported.nodePositions?.["LOCAL-01"]).toEqual({x:14,y:27});
    const map=(await owner.query<{author_user_id:string|null;imported_by:string}>("SELECT author_user_id,imported_by FROM workspace_entity_map WHERE project_id=$1",[first.result])).rows[0];
    expect(map.author_user_id).toBeNull();expect(map.imported_by).toBe(a.id);
  });
  it("hides and restores graph records across teammates without removing source originals, versions, links or positions",async()=>{
    const created=await revise(a,"addRecord",[{kind:"source",title:"Visibility fixture",body:"Original remains intact"}]);
    const recordId=created.result as string;
    await revise(a,"updateRecord",[recordId,{body:"A later authored explanation"}]);
    const other=(await getWorkspace(a,{project:projectA})).projects.find(p=>p.id===projectA)!.records.find(r=>r.id!==recordId)!;
    await revise(a,"addLink",[{from:recordId,to:other.id,label:"Visibility fixture link",status:"accepted"}]);
    await revise(a,"setNodePosition",[recordId,{x:144,y:222}]);
    const before=(await getWorkspace(a,{project:projectA})).projects.find(p=>p.id===projectA)!;
    const mapping=(await owner.query<{entity_id:string}>("SELECT entity_id FROM workspace_entity_map WHERE project_id=$1 AND local_id=$2",[projectA,recordId])).rows[0];
    const original=(await owner.query("SELECT * FROM source_events WHERE id=$1",[mapping.entity_id])).rows[0];
    const versions=(await owner.query("SELECT * FROM annotations WHERE entity_id=$1 AND field='workspace_record' ORDER BY created_at,id",[mapping.entity_id])).rows;
    const canonicalLinks=(await owner.query("SELECT id,invalidated_at FROM relations WHERE from_id=$1 OR to_id=$1 ORDER BY id",[mapping.entity_id])).rows;
    const command=request("hideRecord",[recordId],projectA,before.serverRevision);
    const hidden=await executeWorkspaceCommand(a,command);
    const hiddenProject=hidden.projects.find(p=>p.id===projectA)!;
    expect(hiddenProject.hiddenRecordIds).toContain(recordId);
    expect(hiddenProject.serverRevision).toBe(before.serverRevision!+1);
    expect(hiddenProject.records).toEqual(before.records);expect(hiddenProject.links).toEqual(before.links);expect(hiddenProject.nodePositions).toEqual(before.nodePositions);
    expect((await getWorkspace(b,{project:projectA})).projects.find(p=>p.id===projectA)!.hiddenRecordIds).toContain(recordId);
    const replay=await executeWorkspaceCommand(a,command);expect("replayed" in replay && replay.replayed).toBe(true);expect(replay.projects.find(p=>p.id===projectA)!.serverRevision).toBe(hiddenProject.serverRevision);
    await expect(executeWorkspaceCommand(a,request("restoreRecord",[recordId],projectA,before.serverRevision))).rejects.toMatchObject({code:"revision_conflict"});
    const restored=(await revise(a,"restoreRecord",[recordId])).projects.find(p=>p.id===projectA)!;
    expect(restored.hiddenRecordIds??[]).not.toContain(recordId);expect(restored.serverRevision).toBe(hiddenProject.serverRevision!+1);
    expect(restored.records).toEqual(before.records);expect(restored.links).toEqual(before.links);expect(restored.nodePositions).toEqual(before.nodePositions);
    await expect(executeWorkspaceCommand(a,request("hideRecord",[recordId],projectA,restored.serverRevision),{afterCanonicalWrite:()=>{throw new Error("visibility rollback fixture");}})).rejects.toThrow("visibility rollback fixture");
    const afterRollback=(await getWorkspace(a,{project:projectA})).projects.find(p=>p.id===projectA)!;
    expect(afterRollback.hiddenRecordIds??[]).not.toContain(recordId);expect(afterRollback.serverRevision).toBe(restored.serverRevision);
    expect((await owner.query("SELECT * FROM source_events WHERE id=$1",[mapping.entity_id])).rows[0]).toEqual(original);
    expect((await owner.query("SELECT * FROM annotations WHERE entity_id=$1 AND field='workspace_record' ORDER BY created_at,id",[mapping.entity_id])).rows).toEqual(versions);
    expect((await owner.query("SELECT id,invalidated_at FROM relations WHERE from_id=$1 OR to_id=$1 ORDER BY id",[mapping.entity_id])).rows).toEqual(canonicalLinks);
  });
  it("restricts visibility changes to the author/importer or team lead and keeps coach and foreign teams read-only",async()=>{
    const own=(await revise(b,"addRecord",[{kind:"source",title:"Member visibility fixture",body:"Member-authored"}])).result as string;
    const leadRecord=(await getWorkspace(a,{project:projectA})).projects.find(p=>p.id===projectA)!.records.find(record=>record.author===a.displayName)!;
    for(const action of ["hideRecord","restoreRecord"]){
      await expect(revise(b,action,[leadRecord.id])).rejects.toMatchObject({code:"forbidden"});
      await expect(revise(coach,action,[own])).rejects.toMatchObject({code:"forbidden"});
      await expect(executeWorkspaceCommand(c,request(action,[own],projectA,0))).rejects.toMatchObject({code:"forbidden"});
    }
    await revise(b,"hideRecord",[own]);
    await revise(a,"restoreRecord",[own]);
    await revise(a,"hideRecord",[own]);
    const restored=await revise(b,"restoreRecord",[own]);expect(restored.projects.find(p=>p.id===projectA)!.hiddenRecordIds??[]).not.toContain(own);
    await expect(revise(a,"hideRecord",[randomUUID()])).rejects.toMatchObject({code:"forbidden"});
    const input=request("hideRecord",[own,"unexpected"],projectA,restored.projects.find(p=>p.id===projectA)!.serverRevision);
    await expect(executeWorkspaceCommand(a,input)).rejects.toBeDefined();
  });
  it("allows an importing student to hide and restore an imported record without promoting its original author label",async()=>{
    const text=JSON.stringify({schemaVersion:1,project:{id:"IMPORTED-VISIBILITY",name:"Visibility import fixture",description:"Synthetic imported fixture",dataKind:"personal",
      records:[{id:"IMPORT-SOURCE",kind:"source",title:"Imported visibility source",body:"Original imported explanation",author:"External fixture author",createdAt:"2026-09-01T10:00:00Z"}],links:[],studyRows:[]}});
    const preview=await executeWorkspaceCommand(b,request("previewImport",[text],projectA));
    const previewId=(preview.result as {previewId:string}).previewId;
    const imported=await executeWorkspaceCommand(b,request("importProject",[text,{previewId}],projectA));
    const importedId=imported.activeProjectId!,project=imported.projects.find(item=>item.id===importedId)!;
    const mapping=(await owner.query<{author_user_id:string|null;imported_by:string}>("SELECT author_user_id,imported_by FROM workspace_entity_map WHERE project_id=$1 AND local_id='IMPORT-SOURCE'",[importedId])).rows[0];
    expect(mapping).toEqual({author_user_id:null,imported_by:b.id});
    const hidden=await executeWorkspaceCommand(b,request("hideRecord",["IMPORT-SOURCE"],importedId,project.serverRevision));
    expect(hidden.projects.find(item=>item.id===importedId)!.hiddenRecordIds).toContain("IMPORT-SOURCE");
    const revision=hidden.projects.find(item=>item.id===importedId)!.serverRevision;
    const restored=await executeWorkspaceCommand(b,request("restoreRecord",["IMPORT-SOURCE"],importedId,revision));
    const after=restored.projects.find(item=>item.id===importedId)!;
    expect(after.hiddenRecordIds??[]).not.toContain("IMPORT-SOURCE");expect(after.records).toEqual(project.records);
    expect(after.records[0].originalAuthorLabel).toBe("External fixture author");expect(after.records[0].authorProvenance).toMatch(/unverified$/);
  });
  it("does not rewrite evidence snapshots when moving layout; membership revocation denies next read",async()=>{
    const state=await getWorkspace(a,{team:teamA,project:projectA}),project=state.projects.find(p=>p.id===projectA)!;
    const count=async()=> (await owner.query<{count:string}>("SELECT count(*) FROM annotations WHERE entity_id=$1 AND field='workspace_snapshot'",[projectA])).rows[0].count;
    const before=await count();
    await revise(a,"setNodePosition",[project.records[0].id,{x:110,y:90}]);
    expect(await count()).toBe(before);
    await owner.query("UPDATE team_memberships SET status='removed' WHERE team_id=$1 AND user_id=$2",[teamA,b.id]);
    await expect(getWorkspace(b,{team:teamA,project:projectA})).rejects.toMatchObject({status:403});
  });
});


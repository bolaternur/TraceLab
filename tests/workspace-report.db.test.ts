import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import type { WorkspaceUser } from "@/server/workspace-service";
import type { StorageAdapter } from "@/server/storage";

const configured=Boolean(process.env.DATABASE_URL&&process.env.DATABASE_MIGRATION_URL);
describe.skipIf(!configured)("server reports — real isolated PostgreSQL and guarded storage",()=>{
  let executeWorkspaceCommand: typeof import("@/server/workspace-service")["executeWorkspaceCommand"];
  let getWorkspace: typeof import("@/server/workspace-service")["getWorkspace"];
  let createWorkspaceReport: typeof import("@/server/workspace-report-service")["createWorkspaceReport"];
  let downloadWorkspaceReport: typeof import("@/server/workspace-report-service")["downloadWorkspaceReport"];
  let previewWorkspaceReport: typeof import("@/server/workspace-report-service")["previewWorkspaceReport"];
  let cancelWorkspaceReport: typeof import("@/server/workspace-report-service")["cancelWorkspaceReport"];
  let databaseChecked=false;
  const owner=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
  const users:WorkspaceUser[]=Array.from({length:4},(_,i)=>({id:randomUUID(),displayName:"Report fixture "+i,locale:"en"}));
  const [a,b,c,unverified]=users;const teams:string[]=[];const objects=new Map<string,Buffer>();
  const storage:StorageAdapter={put:async(key,bytes)=>{if(objects.has(key))throw new Error("immutable object exists");objects.set(key,Buffer.from(bytes));},get:async key=>objects.get(key)??null,delete:async key=>{objects.delete(key);},deletePrefix:async()=>{throw new Error("not allowed");}};
  let teamId:string,projectId:string,recordId:string;
  const command=(command:string,args:unknown[],extra:Record<string,unknown>={})=>({command,args,requestId:randomUUID(),...extra});
  const input=(extra:Record<string,unknown>={})=>({projectId,requestId:randomUUID(),format:"json",locale:"en",purpose:"engineering",acknowledgeWarnings:true,...extra});
  async function update(body:string){const state=await getWorkspace(a,{project:projectId}),p=state.projects.find(item=>item.id===projectId)!;
    return executeWorkspaceCommand(a,command("updateRecord",[recordId,{body}],{projectId,expectedRevision:p.serverRevision}));}
  beforeAll(async()=>{
    const name=(await owner.query<{name:string}>("SELECT current_database() AS name")).rows[0].name;if(!name.startsWith("tracelab_unified_"))throw new Error("Isolated test DB required");
    databaseChecked=true;
    ({executeWorkspaceCommand,getWorkspace}=await import("@/server/workspace-service"));
    ({createWorkspaceReport,downloadWorkspaceReport,previewWorkspaceReport,cancelWorkspaceReport}=await import("@/server/workspace-report-service"));
    for(const [index,user] of users.entries()){await owner.query("INSERT INTO users(id,email,password_hash,display_name,locale) VALUES($1,$2,'test-only',$3,'en')",[user.id,user.id+"@example.invalid",user.displayName]);await owner.query("INSERT INTO account_verification(user_id,verified_at) VALUES($1,$2)",[user.id,index===3?null:new Date()]);}
    const created=await executeWorkspaceCommand(a,command("createTeam",[{name:"Report test",season:"2026 fixture",project:"Evidence report",timezone:"UTC",program:"OTHER",locale:"en"}]));
    teamId=created.team!.id;projectId=created.activeProjectId!;teams.push(teamId);
    await owner.query("INSERT INTO team_memberships(team_id,user_id,role,status) VALUES($1,$2,'student','active')",[teamId,b.id]);
    const other=await executeWorkspaceCommand(c,command("createTeam",[{name:"Foreign report team",season:"2026 fixture",project:"Foreign",timezone:"UTC",program:"OTHER",locale:"en"}]));teams.push(other.team!.id);
    const added=await executeWorkspaceCommand(a,command("addRecord",[{kind:"source",title:"Original evidence",body:"Student original body"}],{projectId,expectedRevision:0}));recordId=added.result as string;
  });
  afterAll(async()=>{try{if(databaseChecked){for(const id of teams)await owner.query("DELETE FROM teams WHERE id=$1",[id]);for(const user of users)await owner.query("DELETE FROM users WHERE id=$1",[user.id]);}}finally{await owner.end();}});
  it("previews real counts and blocks unknown competition policy, unverified users and unacknowledged privacy review",async()=>{
    const preview=await previewWorkspaceReport(a,projectId);expect(preview.records).toHaveLength(1);expect(preview.policyGate.allowed).toBe(false);
    expect(preview.records[0].authoredByMe).toBe(true);
    expect((await previewWorkspaceReport(b,projectId)).records[0].authoredByMe).toBe(false);
    await expect(createWorkspaceReport(a,input({purpose:"competition"}),{storage})).rejects.toMatchObject({code:"policy_review_required"});
    await expect(createWorkspaceReport(a,input({acknowledgeWarnings:false}),{storage})).rejects.toMatchObject({code:"warnings_require_review"});
    await expect(previewWorkspaceReport(unverified,projectId)).rejects.toMatchObject({code:"verification_required"});
    await expect(previewWorkspaceReport(c,projectId)).rejects.toMatchObject({status:403});
  });
  it("creates an immutable file + exact manifest, shares within team, idempotently replays and isolates foreign tenant",async()=>{
    const request=input(),first=await createWorkspaceReport(a,request,{storage}),again=await createWorkspaceReport(a,request,{storage});
    expect(again.exportId).toBe(first.exportId);expect(again.replayed).toBe(true);expect(objects.size).toBe(1);
    const history=(await previewWorkspaceReport(a,projectId)).exports.find(item=>item.id===first.exportId);
    expect(history?.requestId).toBe(request.requestId);expect(history?.creatorId).toBe(a.id);
    expect(history?.options).toMatchObject({projectId,format:"json",acknowledgeWarnings:true});
    await expect(createWorkspaceReport(a,{...request,locale:"ru"},{storage})).rejects.toMatchObject({code:"idempotency_conflict"});
    const file=await downloadWorkspaceReport(b,first.exportId,storage);const json=JSON.parse(file.bytes.toString());
    expect(json.project.records[0].body).toBe("Student original body");expect(json.manifest.records[0].localId).toBe(recordId);expect(json.manifest.records[0].annotationId).toBeTruthy();
    expect(first.manifest.output.bytes).toBe(file.bytes.length);expect(first.manifest.output.sha256).toBe(file.manifest.output.sha256);
    expect(file.bytes.toString()).not.toContain("storageKey");
    await expect(downloadWorkspaceReport(c,first.exportId,storage)).rejects.toMatchObject({status:403});
    await expect(owner.query("UPDATE exports SET hash='tampered' WHERE id=$1",[first.exportId])).rejects.toMatchObject({code:"23514"});
  });
  it("creates a new version after annotation edit while the previous output remains unchanged",async()=>{
    const old=await createWorkspaceReport(a,input(),{storage});await update("Later human annotation");const latest=await createWorkspaceReport(a,input(),{storage});
    expect(latest.manifest.version).toBe(old.manifest.version+1);expect(latest.manifest.records[0].annotationId).not.toBe(old.manifest.records[0].annotationId);
    const oldData=JSON.parse((await downloadWorkspaceReport(a,old.exportId,storage)).bytes.toString());const newData=JSON.parse((await downloadWorkspaceReport(a,latest.exportId,storage)).bytes.toString());
    expect(oldData.project.records[0].body).toBe("Student original body");expect(newData.project.records[0].body).toBe("Later human annotation");
    expect(newData.manifest.records[0].annotationHistory.length).toBeGreaterThan(1);
  });
  it("persists recoverable failure, removes the uncommitted object and retries the same fixed snapshot",async()=>{
    const request=input(),before=objects.size;
    await expect(createWorkspaceReport(a,request,{storage,afterStorage:()=>{throw new Error("forced failure after storage");}})).rejects.toMatchObject({code:"report_generation_failed"});
    expect(objects.size).toBe(before);
    const job=(await owner.query("SELECT state,input,export_id FROM workspace_export_jobs WHERE user_id=$1 AND request_id=$2",[a.id,request.requestId])).rows[0];expect(job.state).toBe("failed");
    await update("Newest project text after failed report");const retried=await createWorkspaceReport(a,request,{storage});
    expect(retried.exportId).toBe(job.export_id);const json=JSON.parse((await downloadWorkspaceReport(a,retried.exportId,storage)).bytes.toString());expect(json.project.records[0].body).toBe("Later human annotation");
  });
  it("cancels unfinished jobs and re-checks membership after storage access",async()=>{
    const request=input();await expect(createWorkspaceReport(a,request,{storage,afterStorage:()=>{throw new Error("cancel fixture");}})).rejects.toBeDefined();
    const job=(await owner.query("SELECT export_id FROM workspace_export_jobs WHERE user_id=$1 AND request_id=$2",[a.id,request.requestId])).rows[0];
    expect((await cancelWorkspaceReport(a,job.export_id)).state).toBe("cancelled");await expect(createWorkspaceReport(a,request,{storage})).rejects.toMatchObject({code:"report_cancelled"});
    const ready=await createWorkspaceReport(a,input(),{storage});
    const revokeOnRead={...storage,get:async(key:string)=>{await owner.query("UPDATE team_memberships SET status='removed' WHERE team_id=$1 AND user_id=$2",[teamId,b.id]);return storage.get(key);}};
    await expect(downloadWorkspaceReport(b,ready.exportId,revokeOnRead)).rejects.toMatchObject({status:403});
  });
});

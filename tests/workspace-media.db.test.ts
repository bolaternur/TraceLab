import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import sharp from "sharp";
import type { WorkspaceUser } from "@/server/workspace-service";
import { uploadMetadata,MEDIA_LIMITS } from "@/server/workspace-media-contract";
import type { StorageAdapter } from "@/server/storage";

// Explicit opt-in: importing this suite must not initialize the application DB.
const configured=process.env.RUN_WORKSPACE_MEDIA_DB_TESTS==="true"&&Boolean(process.env.DATABASE_URL&&process.env.DATABASE_MIGRATION_URL);
describe.skipIf(!configured)("private media — real PostgreSQL transactions and RLS, memory file adapter",()=>{
  let executeWorkspaceCommand:typeof import("@/server/workspace-service").executeWorkspaceCommand;
  let getWorkspace:typeof import("@/server/workspace-service").getWorkspace;
  let cleanupWorkspaceUploads:typeof import("@/server/workspace-media-service").cleanupWorkspaceUploads;
  let listWorkspaceMedia:typeof import("@/server/workspace-media-service").listWorkspaceMedia;
  let readWorkspaceMedia:typeof import("@/server/workspace-media-service").readWorkspaceMedia;
  let updateWorkspaceMedia:typeof import("@/server/workspace-media-service").updateWorkspaceMedia;
  let uploadWorkspaceMedia:typeof import("@/server/workspace-media-service").uploadWorkspaceMedia;
  const owner=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
  const people:WorkspaceUser[]=Array.from({length:5},(_,i)=>({id:randomUUID(),displayName:"Media test "+i,locale:"en"}));
  const [a,b,foreign,coach,unverified]=people,teams:string[]=[];
  const files=new Map<string,Buffer>();
  const storage:StorageAdapter={put:async(key,bytes)=>{files.set(key,Buffer.from(bytes));},get:async key=>files.get(key)??null,
    delete:async key=>{files.delete(key);},deletePrefix:async()=>{throw new Error("no bulk deletion in tests");}};
  let teamId:string,projectId:string,photo:Buffer,artifactId:string,sourceId:string;
  const input=()=>uploadMetadata.parse({teamId,projectId,requestId:randomUUID(),kind:"photo",name:"Isolated test photo",filename:"../source.png",caption:"Original student observation",alt:"Test fixture",occurredAt:"2026-10-26T12:00:00Z"});
  const state=async()=>getWorkspace(a,{team:teamId,project:projectId});
  beforeAll(async()=>{
    const database=(await owner.query<{current_database:string}>("SELECT current_database()")).rows[0].current_database;
    if(!database.startsWith("tracelab_unified_"))throw new Error("Refusing media tests outside isolated tracelab_unified_* database");
    ({executeWorkspaceCommand,getWorkspace}=await import("@/server/workspace-service"));
    ({cleanupWorkspaceUploads,listWorkspaceMedia,readWorkspaceMedia,updateWorkspaceMedia,uploadWorkspaceMedia}=await import("@/server/workspace-media-service"));
    for(const person of people){await owner.query("INSERT INTO users(id,email,password_hash,display_name,locale) VALUES($1,$2,'test-only',$3,'en')",[person.id,person.id+"@example.invalid",person.displayName]);
      await owner.query("INSERT INTO account_verification(user_id,verified_at) VALUES($1,$2)",[person.id,person===unverified?null:new Date()]);}
    const created=await executeWorkspaceCommand(a,{command:"createTeam",requestId:randomUUID(),args:[{name:"Isolated media team",season:"test",project:"Media fixtures",timezone:"UTC",program:"OTHER",locale:"en"}]});
    teamId=created.team!.id;projectId=created.activeProjectId!;teams.push(teamId);
    await owner.query("INSERT INTO team_memberships(team_id,user_id,role) VALUES($1,$2,'student'),($1,$3,'coach')",[teamId,b.id,coach.id]);
    photo=await sharp({create:{width:10,height:20,channels:3,background:"#a087bd"}}).png().toBuffer();
  });
  afterAll(async()=>{for(const team of teams)await owner.query("DELETE FROM teams WHERE id=$1",[team]);for(const person of people)await owner.query("DELETE FROM users WHERE id=$1",[person.id]);await owner.end();files.clear();});
  it("creates one source, artifact, thumbnail and workspace record; retry is exactly idempotent",async()=>{
    const values=input(),first=await uploadWorkspaceMedia(a,values,photo,{storage}),again=await uploadWorkspaceMedia(a,values,photo,{storage});
    artifactId=first.artifactId!;expect(again.artifactId).toBe(artifactId);expect(again.replayed).toBe(true);expect(files.size).toBe(2);
    const row=(await owner.query<{source_event_id:string}>("SELECT source_event_id FROM artifacts WHERE id=$1",[artifactId])).rows[0];sourceId=row.source_event_id;
    expect((await state()).projects.find(p=>p.id===projectId)!.records.filter(r=>r.id===first.recordId)).toHaveLength(1);
    const saved=await readWorkspaceMedia(b,artifactId,false,storage);expect(saved.mimeType).toBe("image/png");expect(saved.item.authorUserId).toBe(a.id);
    expect((await readWorkspaceMedia(coach,artifactId,true,storage)).mimeType).toBe("image/webp");
    await expect(uploadWorkspaceMedia(a,{...values,caption:"A different body"},photo,{storage})).rejects.toMatchObject({code:"idempotency_conflict"});
  });
  it("denies other tenants, unverified and coach writes; caption versions never mutate source",async()=>{
    await expect(listWorkspaceMedia(foreign,{teamId,projectId})).rejects.toMatchObject({status:403});
    await expect(readWorkspaceMedia(foreign,artifactId,false,storage)).rejects.toMatchObject({status:404});
    await expect(uploadWorkspaceMedia(coach,input(),photo,{storage})).rejects.toMatchObject({status:403});
    await expect(uploadWorkspaceMedia(unverified,input(),photo,{storage})).rejects.toMatchObject({code:"verification_required"});
    await expect(updateWorkspaceMedia(b,artifactId,{name:"intrusion",caption:"overwrite",alt:"",status:"active"})).rejects.toMatchObject({status:403});
    await owner.query("UPDATE team_memberships SET role='student_lead' WHERE team_id=$1 AND user_id=$2",[teamId,b.id]);
    await expect(updateWorkspaceMedia(b,artifactId,{name:"lead intrusion",caption:"overwrite",alt:"",status:"active"})).rejects.toMatchObject({status:403});
    expect((await listWorkspaceMedia(b,{teamId,projectId})).items[0].canEdit).toBe(false);
    await owner.query("UPDATE team_memberships SET role='student' WHERE team_id=$1 AND user_id=$2",[teamId,b.id]);
    await updateWorkspaceMedia(a,artifactId,{name:"Updated label",caption:"Later caption",alt:"Alt",status:"archived"});
    const listing=await listWorkspaceMedia(b,{teamId,projectId});expect(listing.items[0].name).toBe("Updated label");expect(listing.items[0].status).toBe("archived");
    expect((await owner.query<{summary:string}>("SELECT summary FROM source_events WHERE id=$1",[sourceId])).rows[0].summary).toBe("Original student observation");
    await expect(owner.query("UPDATE artifacts SET sha256='changed' WHERE id=$1",[artifactId])).rejects.toMatchObject({code:"23514"});
  });
  it("rolls back source, snapshot, artifact and model writes after a later fault and cleans only staging bytes",async()=>{
    const before=await state(),size=files.size,values=input();
    await expect(uploadWorkspaceMedia(a,values,photo,{storage,afterCanonicalWrite:()=>{throw new Error("injected later failure");}})).rejects.toThrow("injected later failure");
    expect((await state()).projects).toEqual(before.projects);expect(files.size).toBe(size);
    const upload=(await owner.query<{status:string;artifact_id:string|null}>("SELECT status,artifact_id FROM workspace_uploads WHERE user_id=$1 AND request_id=$2",[a.id,values.requestId])).rows[0];
    expect(upload).toEqual({status:"cleaned",artifact_id:null});
    expect((await readWorkspaceMedia(b,artifactId,false,storage)).bytes.length).toBeGreaterThan(0);
  });
  it("recovers a partially written staging file and safely retries the same request",async()=>{
    const size=files.size,values=input();let fail=true;
    const failing={...storage,put:async(key:string,bytes:Buffer,type:string)=>{await storage.put(key,bytes,type);if(fail){fail=false;throw new Error("injected storage failure");}}};
    await expect(uploadWorkspaceMedia(a,values,photo,{storage:failing})).rejects.toThrow("injected storage failure");expect(files.size).toBe(size);
    const result=await uploadWorkspaceMedia(a,values,photo,{storage});expect(result.artifactId).toBeTruthy();expect(files.size).toBe(size+2);
  });
  it("rechecks revoked membership at finalize and blocks the next download",async()=>{
    const values=input();await expect(uploadWorkspaceMedia(b,values,photo,{storage,beforeFinalize:async()=>{
      await owner.query("UPDATE team_memberships SET status='removed' WHERE team_id=$1 AND user_id=$2",[teamId,b.id]);
    }})).rejects.toMatchObject({status:403});
    await expect(readWorkspaceMedia(b,artifactId,false,storage)).rejects.toMatchObject({status:404});
    expect((await owner.query("SELECT id FROM workspace_uploads WHERE user_id=$1 AND request_id=$2 AND artifact_id IS NOT NULL",[b.id,values.requestId])).rowCount).toBe(0);
    await owner.query("UPDATE workspace_uploads SET expires_at=now()-interval '1 minute' WHERE user_id=$1 AND request_id=$2",[b.id,values.requestId]);
    await cleanupWorkspaceUploads(a,teamId,projectId,storage);
    expect((await owner.query<{status:string}>("SELECT status FROM workspace_uploads WHERE user_id=$1 AND request_id=$2",[b.id,values.requestId])).rows[0].status).toBe("cleaned");
  });
  it("blocks a foreign model-version reference before writing any bytes",async()=>{
    const before=files.size,values=uploadMetadata.parse({...input(),kind:"model",filename:"part.glb",model:{category:"part",versionLabel:"v2",previousModelId:randomUUID()}});
    // A valid self-contained triangle (a test fixture, never a seed/user engineering model).
    const bin=Buffer.alloc(36);[0,0,0,1,0,0,0,1,0].forEach((n,i)=>bin.writeFloatLE(n,i*4));
    const json=Buffer.from(JSON.stringify({asset:{version:"2.0"},buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:"VEC3"}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}]}));
    const padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);const head=Buffer.alloc(20),tail=Buffer.alloc(8);head.write("glTF");head.writeUInt32LE(2,4);head.writeUInt32LE(28+padded.length+36,8);head.writeUInt32LE(padded.length,12);head.writeUInt32LE(0x4e4f534a,16);tail.writeUInt32LE(36);tail.writeUInt32LE(0x004e4942,4);const bytes=Buffer.concat([head,padded,tail,bin]);
    await expect(uploadWorkspaceMedia(a,values,bytes,{storage})).rejects.toMatchObject({status:403});expect(files.size).toBe(before);
    const v1=await uploadWorkspaceMedia(a,{...values,requestId:randomUUID(),model:{category:"part",versionLabel:"v1",tags:[]}},bytes,{storage});
    const v2=await uploadWorkspaceMedia(a,{...values,requestId:randomUUID(),model:{...values.model!,previousModelId:v1.modelId!}},bytes,{storage});
    expect(v1.artifactId).not.toBe(v2.artifactId);expect(v1.modelId).not.toBe(v2.modelId);
    expect((await readWorkspaceMedia(a,v1.artifactId!,false,storage)).bytes).toEqual(bytes);
    const models=await listWorkspaceMedia(a,{teamId,projectId,mode:"models"});expect(models.items.find(row=>row.model?.id===v2.modelId)?.model?.previousModelId).toBe(v1.modelId);
  });
  it("enforces team usage before new writes, counting thumbnail bytes and pending reservations",async()=>{
    const size=files.size,id=randomUUID();
    await owner.query(`INSERT INTO workspace_uploads(id,user_id,request_id,team_id,project_id,payload_hash,reserved_bytes,storage_keys)
      VALUES($1,$2,$3,$4,$5,'quota-test',$6,'[]')`,[id,a.id,randomUUID(),teamId,projectId,MEDIA_LIMITS.teamBytes]);
    await expect(uploadWorkspaceMedia(a,input(),photo,{storage})).rejects.toMatchObject({code:"storage_quota_exceeded"});expect(files.size).toBe(size);
  });
});

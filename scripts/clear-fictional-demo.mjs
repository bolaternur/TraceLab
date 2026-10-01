import "dotenv/config";
import pg from "pg";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Only records matching the original seed's exact values qualify. Default is a dry run.
const seed = readFileSync(new URL("../src/db/seed.ts", import.meta.url), "utf8");
const titles = [...seed.matchAll(/title: "([^"]+)"/g)].map((m) => m[1]);
const bodies = [...seed.matchAll(/body: "([^"]+)"/g)].map((m) => m[1]);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows: memberships } = await client.query("select tm.team_id from team_memberships tm join users u on u.id=tm.user_id where u.email=$1 and tm.status='active'", ["lead@trace.demo"]);
  if (memberships.length !== 1) throw new Error("Expected exactly one demo workspace; nothing changed.");
  const team = memberships[0].team_id;
  await client.query("BEGIN");
  const selection = {};
  const events = (await client.query("select * from source_events where team_id=$1", [team])).rows;
  selection.source_events = events.filter((e) => !e.client_id && e.content_hash === hash(e.title) && e.provider_event_id === `${e.provider}-${hash(e.title + e.occurred_at.toISOString()).slice(0, 12)}`);
  const seedTimes = selection.source_events.map((e) => e.created_at.getTime());
  const start = Math.min(...seedTimes) - 60000;
  const end = Math.max(...seedTimes) + 1000;
  for (const table of ["iterations", "tests", "decisions"]) {
    selection[table] = (await client.query(`select * from ${table} where team_id=$1 and title=ANY($2::text[])`, [team, titles])).rows.filter((r) => r.created_at.getTime() >= start && r.created_at.getTime() <= end);
  }
  const ids = Object.values(selection).flat().map((r) => r.id);
  selection.annotations = (await client.query("select * from annotations where team_id=$1 and body=ANY($2::text[])", [team, bodies])).rows;
  const otherNotes = (await client.query("select * from annotations where team_id=$1 and entity_id=ANY($2::uuid[]) and not(id=ANY($3::uuid[]))", [team, ids, selection.annotations.map((r) => r.id)])).rows;
  console.log(`Preserving ${otherNotes.length} real notes as standalone observations.`);
  selection.relations = (await client.query("select * from relations where team_id=$1 and (from_id=ANY($2::uuid[]) or to_id=ANY($2::uuid[]))", [team, ids])).rows;
  selection.artifacts = (await client.query("select * from artifacts where team_id=$1 and source_event_id=ANY($2::uuid[])", [team, selection.source_events.map((r) => r.id)])).rows;
  if (selection.artifacts.some((a) => a.storage_key)) throw new Error("An uploaded file is attached to a demo event; nothing changed.");
  selection.source_connections = (await client.query("select * from source_connections where team_id=$1 and encrypted_secret is null and ((external_id='team/orion-robot' and config->>'note'='seeded demo connection') or (external_id='d-orion' and config->>'note'='awaiting ONSHAPE_CLIENT_ID'))", [team])).rows;
  // Remove only unchanged seed identities from this team, never their user records.
  selection.team_memberships = (await client.query(`select tm.* from team_memberships tm join users u on u.id=tm.user_id
    where tm.team_id=$1 and ((u.email='anim@trace.demo' and u.display_name='Anim K.')
      or (u.email='dana@trace.demo' and u.display_name='Dana T.') or (u.email='coach@trace.demo' and u.display_name='Coach Murat'))
    and not exists(select 1 from source_events e where e.team_id=tm.team_id and e.actor_user_id=u.id and e.client_id is not null)
    and not exists(select 1 from annotations a where a.team_id=tm.team_id and a.author_user_id=u.id and not(a.body=ANY($2::text[])))`, [team, bodies])).rows;
  console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "preview", counts: Object.fromEntries(Object.entries(selection).map(([k,v])=>[k,v.length])), preservedEvents: events.filter((e)=>!ids.includes(e.id)).map((e)=>({id:e.id,title:e.title})) }, null, 2));
  if (!process.argv.includes("--apply")) { await client.query("ROLLBACK"); }
  else {
    await client.query("CREATE SCHEMA IF NOT EXISTS tracelab_demo_archive");
    await client.query("REVOKE ALL ON SCHEMA tracelab_demo_archive FROM PUBLIC");
    await client.query("CREATE TABLE IF NOT EXISTS tracelab_demo_archive.records (batch_id uuid not null, table_name text not null, record jsonb not null, archived_at timestamptz not null default now())");
    const batch = (await client.query("select gen_random_uuid() as id")).rows[0].id;
    for (const note of otherNotes) {
      await client.query("insert into tracelab_demo_archive.records(batch_id,table_name,record) values($1,'preserved_annotation_before_detach',$2)",[batch,JSON.stringify(note)]);
      const event = (await client.query("insert into source_events(team_id,provider,provider_event_id,event_type,actor_user_id,title,summary,occurred_at,raw_metadata,content_hash,status) values($1,'capture',$2,'reflection',$3,$4,$5,$6,$7,$8,'inbox') returning id",[team,`preserved-note-${note.id}`,note.author_user_id,note.body.slice(0,160),note.body,note.created_at,JSON.stringify({recoveredFromAnnotation:note.id,originalEntityId:note.entity_id}),hash(JSON.stringify(note))])).rows[0];
      await client.query("update annotations set entity_type='source_event',entity_id=$1 where id=$2 and team_id=$3",[event.id,note.id,team]);
    }
    for (const [table, rows] of Object.entries(selection)) {
      for (const row of rows) await client.query("insert into tracelab_demo_archive.records(batch_id,table_name,record) values($1,$2,$3)", [batch,table,JSON.stringify(row)]);
    }
    // Preserve actual uploads that were attached to a fictional iteration.
    const iterationIds = selection.iterations.map((r)=>r.id);
    const linked = (await client.query("select * from source_events where team_id=$1 and iteration_id=ANY($2::uuid[]) and not(id=ANY($3::uuid[]))",[team,iterationIds,selection.source_events.map((r)=>r.id)])).rows;
    for (const row of linked) await client.query("insert into tracelab_demo_archive.records(batch_id,table_name,record) values($1,'preserved_event_before_detach',$2)",[batch,JSON.stringify(row)]);
    await client.query("update source_events set iteration_id=null,status='inbox' where team_id=$1 and iteration_id=ANY($2::uuid[]) and not(id=ANY($3::uuid[]))",[team,iterationIds,selection.source_events.map((r)=>r.id)]);
    for (const table of ["relations","annotations","artifacts","source_events","tests","decisions","iterations","source_connections","team_memberships"]) {
      await client.query(`delete from ${table} where team_id=$1 and id=ANY($2::uuid[])`, [team,selection[table].map((r)=>r.id)]);
    }
    await client.query("COMMIT");
    console.log(`Archived fictional records in batch ${batch}. User uploads and models retained.`);
  }
} catch (error) { await client.query("ROLLBACK"); throw error; }
finally { await client.end(); }

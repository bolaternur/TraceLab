import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import pg from "pg";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
const connection = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1", "::1", "[::1]"].includes(connection.hostname), "Local database only");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  const team = (await client.query("SELECT id FROM teams LIMIT 1")).rows[0];
  assert(team, "An existing local team is needed");
  const user = randomUUID();
  await client.query("INSERT INTO users(id,email,password_hash,display_name) VALUES ($1,$2,$3,$4)", [user, `${user}@local.invalid`, "test-only-unusable", "Storage verification"]);
  const save = `INSERT INTO product_reviews(team_id,user_id,body,rating) VALUES ($1,$2,$3,$4) ON CONFLICT(team_id,user_id) DO UPDATE SET body=excluded.body,rating=excluded.rating`;
  await client.query(save, [team.id, user, "Temporary storage verification", 3]);
  await client.query(save, [team.id, user, "Updated temporary verification", 4]);
  const rows = (await client.query("SELECT body,rating FROM product_reviews WHERE team_id=$1 AND user_id=$2", [team.id,user])).rows;
  assert.equal(rows.length, 1); assert.equal(rows[0].rating, 4); assert.equal(rows[0].body, "Updated temporary verification");
  for (let i=0;i<2;i++) await client.query("INSERT INTO product_usage_days(team_id,user_id,day) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [team.id,user,"2026-09-30"]);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM product_usage_days WHERE user_id=$1", [user])).rows[0].n, 1);
  await client.query("DELETE FROM product_reviews WHERE team_id=$1 AND user_id=$2", [team.id,user]);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM product_reviews WHERE user_id=$1", [user])).rows[0].n, 0);
  console.log("Review save/edit/delete and daily deduplication verified; all test changes rolled back.");
} finally { await client.query("ROLLBACK"); await client.end(); }

import {config} from 'dotenv';
import pg from 'pg';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
config({path:'.env.local',quiet:true});config({path:'.env',quiet:true});
const pool=new pg.Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
try{
  const rows=(await pool.query('SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at')).rows;
  const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'));
  let valid=true;
  for(const entry of journal.entries){
    const applied=rows.find(row=>Number(row.created_at)===entry.when);
    const sql=readFileSync(`drizzle/${entry.tag}.sql`,'utf8');
    const matches=applied?.hash===createHash('sha256').update(sql).digest('hex');
    if(!matches)valid=false;
    console.log(JSON.stringify({tag:entry.tag,applied:Boolean(applied),hashMatches:matches}));
  }
  const unknown=rows.filter(row=>!journal.entries.some(entry=>entry.when===Number(row.created_at)));
  if(unknown.length){valid=false;console.error('Database has migration entries missing from the local journal.');}
  if(!valid)process.exitCode=1;
  console.log(JSON.stringify({exportCleanupColumn:(await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='workspace_export_jobs' AND column_name='cleanup_keys'")).rowCount===1}));
}finally{await pool.end();}

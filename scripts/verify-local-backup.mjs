import {config} from 'dotenv';
import pg from 'pg';
import {spawnSync} from 'node:child_process';
import {mkdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
config({path:'.env.local',quiet:true});config({path:'.env',quiet:true});
const source=new URL(process.env.DATABASE_MIGRATION_URL||'');
if(!['localhost','127.0.0.1','[::1]'].includes(source.hostname)||!/^\/tracelab_unified_[a-z0-9_]+$/.test(source.pathname))throw new Error('This check only supports the isolated local unified database.');
const bin=process.env.PG_BIN||path.join(process.env.LOCALAPPDATA||'','TraceLab','postgresql-17.11','pgsql','bin');
const stamp=new Date().toISOString().replace(/[:.]/g,'-'),dir=path.resolve('.data/backups');await mkdir(dir,{recursive:true});
const file=path.join(dir,`${stamp}.dump`),restored=`tracelab_restore_verify_${randomBytes(6).toString('hex')}`;
const env={...process.env,PGHOST:source.hostname,PGPORT:source.port||'5432',PGUSER:decodeURIComponent(source.username),PGPASSWORD:decodeURIComponent(source.password)};
function run(name,args){const result=spawnSync(path.join(bin,name+(process.platform==='win32'?'.exe':'')),args,{env,windowsHide:true,encoding:'utf8'});if(result.status!==0)throw new Error(`${name} failed; original database has not been altered.`);}
const adminUrl=new URL(source);adminUrl.pathname='/postgres';const admin=new pg.Pool({connectionString:adminUrl.toString()});
const original=new pg.Pool({connectionString:source.toString()});let restoredPool,created=false;
async function counts(pool){const tables=['users','teams','projects','source_events','annotations','tests','decisions','relations','artifacts','robot_models','exports'];const result={};for(const table of tables)result[table]=Number((await pool.query(`SELECT count(*) AS count FROM "${table}"`)).rows[0].count);return result;}
try{
  run('pg_dump',['--format=custom','--no-owner','--no-privileges','--file',file,source.pathname.slice(1)]);
  await admin.query(`CREATE DATABASE "${restored}"`);created=true;
  run('pg_restore',['--exit-on-error','--no-owner','--no-privileges','--dbname',restored,file]);
  const destination=new URL(source);destination.pathname='/'+restored;restoredPool=new pg.Pool({connectionString:destination.toString()});
  const [before,after]=await Promise.all([counts(original),counts(restoredPool)]);
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Restore count mismatch. Backup retained for investigation.');
  const manifest={createdAt:new Date().toISOString(),sourceDatabase:source.pathname.slice(1),verifiedDatabase:restored,bytes:(await stat(file)).size,counts:after,note:'PostgreSQL dump and isolated restore verified. Object storage is separate; back up .data/storage or the configured private bucket too.'};await writeFile(file+'.json',JSON.stringify(manifest,null,2));
  console.log(JSON.stringify({backup:file,restoreVerified:true,counts:after}));
}finally{
  await original.end();if(restoredPool)await restoredPool.end();
  // Drop only the uniquely named verification database created by this exact run.
  if(created&&/^tracelab_restore_verify_[0-9a-f]{12}$/.test(restored))await admin.query(`DROP DATABASE "${restored}"`);
  await admin.end();
}

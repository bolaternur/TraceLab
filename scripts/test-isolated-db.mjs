import {config} from 'dotenv';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readdir,readFile} from 'node:fs/promises';
import {startVitest} from 'vitest/node';

// Every invocation creates a new empty database. Existing dev/production schemas
// are never migration or fixture targets; the created database is retained.
config({path:'.env.local',quiet:true});config({path:'.env',quiet:true});
if(!process.env.DATABASE_URL||!process.env.DATABASE_MIGRATION_URL)throw new Error('Local runtime and migration connections are required.');
if(process.env.NODE_ENV==='production')throw new Error('Disposable fixture runner is forbidden in production.');
const localConnections=[new URL(process.env.DATABASE_URL),new URL(process.env.DATABASE_MIGRATION_URL)];
if(localConnections.some(url=>!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.search||url.hash)||(localConnections[0].port||'5432')!==(localConnections[1].port||'5432'))throw new Error('Use plain loopback PostgreSQL URLs on the same local port. Remote or parameter-overridden targets are forbidden.');
const excluded=new Set(['tests/tenancy.db.test.ts']);
const available=(await readdir('tests')).filter(name=>name.endsWith('.db.test.ts')).map(name=>'tests/'+name).filter(file=>!excluded.has(file)).sort();
const args=process.argv.slice(2),files=args.length?args:available;
if(!files.length||files.some(file=>!available.includes(file))||new Set(files).size!==files.length)throw new Error('Select only existing self-contained tests/*.db.test.ts fixtures. Legacy seeded tenancy is excluded.');
console.log(`Running ${files.length} fixture suites. Explicit exclusion: legacy seeded tenancy. Lifecycle is included through registered migration 0015 and its self-contained fixture suite.`);
const database=`tracelab_unified_test_${Date.now()}_${randomUUID().replaceAll('-','').slice(0,8)}`;
if(!/^tracelab_unified_test_[0-9]+_[a-f0-9]{8}$/.test(database)||database.length>63)throw new Error('Invalid disposable database name.');
const owner=new pg.Pool({connectionString:process.env.DATABASE_MIGRATION_URL,max:1,connectionTimeoutMillis:10000});let created=false;
try{const capability=(await owner.query('SELECT rolsuper OR rolcreatedb AS allowed FROM pg_roles WHERE rolname=current_user')).rows[0];if(!capability?.allowed){console.log('No CREATEDB capability. No database created or changed.');process.exitCode=2;}else{await owner.query(`CREATE DATABASE "${database}" TEMPLATE template0`);created=true;}}finally{await owner.end();}
if(created){
  const runtimeUrl=new URL(process.env.DATABASE_URL),migrationUrl=new URL(process.env.DATABASE_MIGRATION_URL);runtimeUrl.pathname='/'+database;migrationUrl.pathname='/'+database;process.env.DATABASE_URL=runtimeUrl.href;process.env.DATABASE_MIGRATION_URL=migrationUrl.href;
  if(new URL(process.env.DATABASE_URL).pathname!=='/'+database||new URL(process.env.DATABASE_MIGRATION_URL).pathname!=='/'+database)throw new Error('Disposable target mismatch.');
  // Enable only flags declared in the selected local fixture sources.
  for(const file of files){const source=await readFile(file,'utf8');for(const match of source.matchAll(/process\.env\.(RUN_[A-Z0-9_]+_DB_TESTS)/g))process.env[match[1]]='true';}
  console.log(`Fresh isolated database: ${database}. Existing databases remain untouched.`);
  const migration=spawnSync(process.execPath,['scripts/migrate-unified.mjs'],{env:{...process.env},stdio:'inherit',windowsHide:true});
  if(migration.status!==0)process.exitCode=migration.status||1;
  else{
    const ctx=await startVitest('test',files,{run:true,fileParallelism:false,maxWorkers:1});if(!ctx)throw new Error('Fixture runner did not start.');
    const results=ctx.state.getFiles(),testsOf=task=>task.type==='test'?[task]:(task.tasks||[]).flatMap(testsOf),executed=results.flatMap(testsOf),incomplete=results.length!==files.length||!executed.length||results.some(file=>file.result?.state!=='pass'||!testsOf(file).length)||executed.some(test=>test.result?.state!=='pass');
    console.log(`Fixture verification: ${results.length}/${files.length} files, ${executed.filter(test=>test.result?.state==='pass').length}/${executed.length} tests passed. Unexpected skips or missing results fail the run.`);
    await ctx.close();process.exitCode=incomplete?1:0;
  }
  console.log(`Database retained for inspection: ${database}. It was not deleted.`);
}

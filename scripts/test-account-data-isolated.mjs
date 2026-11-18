import {config} from 'dotenv';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {startVitest} from 'vitest/node';

config({path:'.env.local',quiet:true});config({path:'.env',quiet:true});
if(!process.env.DATABASE_URL||!process.env.DATABASE_MIGRATION_URL)throw new Error('Local runtime and migration connections are required.');
const runtimeUrl=new URL(process.env.DATABASE_URL),migrationUrl=new URL(process.env.DATABASE_MIGRATION_URL);
if(!['localhost','127.0.0.1','[::1]'].includes(migrationUrl.hostname)||!['localhost','127.0.0.1','[::1]'].includes(runtimeUrl.hostname)||migrationUrl.host!==runtimeUrl.host)throw new Error('Only the same local PostgreSQL server is supported.');
const database=`iznera_test_account_data_${Date.now()}_${randomUUID().replaceAll('-','').slice(0,8)}`;
if(!/^iznera_test_account_data_[0-9]+_[a-f0-9]{8}$/.test(database)||database.length>63)throw new Error('Invalid disposable database name.');
const maintenanceUrl=new URL(migrationUrl);maintenanceUrl.pathname='/postgres';
const owner=new pg.Pool({connectionString:maintenanceUrl.href,max:1,connectionTimeoutMillis:10000});let created=false;
try{const capability=(await owner.query('SELECT rolsuper OR rolcreatedb AS allowed FROM pg_roles WHERE rolname=current_user')).rows[0];
  if(!capability?.allowed){console.log('No CREATEDB capability; no database was created or changed.');process.exitCode=2;}
  else{await owner.query(`CREATE DATABASE "${database}" TEMPLATE template0`);created=true;}
}finally{await owner.end();}
if(created){
  runtimeUrl.pathname='/'+database;migrationUrl.pathname='/'+database;
  process.env.DATABASE_URL=runtimeUrl.href;process.env.DATABASE_MIGRATION_URL=migrationUrl.href;process.env.RUN_ACCOUNT_DATA_DB_TESTS='true';
  if(new URL(process.env.DATABASE_URL).pathname!=='/'+database||new URL(process.env.DATABASE_MIGRATION_URL).pathname!=='/'+database)throw new Error('Disposable target mismatch.');
  console.log(`Created empty disposable account-data database: ${database}. Existing databases are not test targets.`);
  const migration=spawnSync(process.execPath,['scripts/migrate-unified.mjs'],{env:{...process.env},stdio:'inherit',windowsHide:true});
  if(migration.status!==0)process.exitCode=migration.status||1;
  else{const ctx=await startVitest('test',['tests/account-data.db.test.ts'],{run:true});if(!ctx)throw new Error('Account-data test runner did not start.');const failed=ctx.state.getFiles().some(file=>file.result?.state==='fail');await ctx.close();process.exitCode=failed?1:0;}
  console.log(`Disposable database retained for inspection: ${database}. It was not deleted.`);
}

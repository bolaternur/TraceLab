import { spawn } from 'node:child_process';
const run = file => new Promise((resolve, reject) => {
  const child=spawn(process.execPath,[file],{stdio:'inherit',windowsHide:true});
  child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`${file} exited ${code}`)));
});
await run('scripts/start-local-db.mjs');
await run('scripts/prepare-unified.mjs');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3000'],{stdio:'inherit',windowsHide:true});
child.once('exit',code=>{process.exitCode=code||0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));

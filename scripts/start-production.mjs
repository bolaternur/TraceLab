import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pilotEnvironmentChecks, pilotDatabaseChecks } from './pilot-preflight.mjs';
import { productionEnvironment } from './production-environment.mjs';

const require = createRequire(import.meta.url);
const { env, port, failures } = productionEnvironment(process.env);
if (['.env', '.env.local', '.env.production', '.env.production.local'].some(file => existsSync(file))) failures.push('dotenv_files_forbidden_in_release');
failures.push(...pilotEnvironmentChecks(env).filter(check => check.status === 'fail').map(check => check.id));
if (failures.length) {
  console.error(JSON.stringify({ event: 'production_configuration_rejected', settings: [...new Set(failures)] }));
  process.exitCode = 1;
} else {
  const checks = await pilotDatabaseChecks(env.DATABASE_URL, env.DATABASE_RUNTIME_ROLE);
  if (checks.some(check => check.status === 'fail')) {
    console.error(JSON.stringify({ event: 'production_database_rejected', checks }));
    process.exitCode = 1;
  } else {
    const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '0.0.0.0', '--port', String(port)],
      { env, stdio: 'inherit', windowsHide: true });
    for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
    child.on('error', () => { console.error('production_start_failed'); process.exitCode = 1; });
    child.on('exit', code => { process.exitCode = code ?? 1; });
  }
}

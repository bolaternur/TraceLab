import { pathToFileURL } from 'node:url';
import { publicOrigin } from './production-environment.mjs';

/** Invoke from a trusted scheduler; credentials stay out of command arguments/logs. */
export async function dispatchAccountMail(env, transport = fetch) {
  const origin = publicOrigin(env.APP_URL);
  if (!origin || !env.CRON_SECRET || env.CRON_SECRET.length < 32) throw new Error('mail_dispatch_configuration');
  const response = await transport(`${origin}/api/account/mail-dispatch`, {
    method: 'POST', headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    redirect: 'error', signal: AbortSignal.timeout(55000),
  });
  const body = await response.json();
  if (!response.ok || body.ok !== true) throw new Error('mail_dispatch_failed');
  const counts = {};
  for (const name of ['processed', 'sent', 'failed', 'exhausted']) {
    if (!Number.isSafeInteger(body[name]) || body[name] < 0) throw new Error('mail_dispatch_invalid_response');
    counts[name] = body[name];
  }
  return counts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify({ event: 'mail_dispatch', ...await dispatchAccountMail(process.env) })); }
  catch { console.error('mail_dispatch_failed'); process.exitCode = 1; }
}

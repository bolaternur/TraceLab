/** Pure deployment guards. Never include environment values in diagnostics. */
export function publicOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash
      || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

export function verifiedDatabaseUrl(value) {
  try {
    const url = new URL(value);
    // pg consumes the last duplicate query value, while URLSearchParams.get
    // returns the first. Refuse ambiguity before checking the TLS mode.
    const keys = [...url.searchParams.keys()];
    if (new Set(keys).size !== keys.length || url.hash) return false;
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
    return ['postgres:', 'postgresql:'].includes(url.protocol) && Boolean(url.username && url.password)
      && url.pathname.length > 1 && url.searchParams.get('sslmode') === 'verify-full'
      && !['ssl', 'host', 'port', 'user', 'password', 'database'].some(key => url.searchParams.has(key));
  } catch { return false; }
}

export function productionEnvironment(env) {
  const normalized = { ...env, APP_URL: env.APP_URL || env.RENDER_EXTERNAL_URL };
  const failures = [];
  if (!publicOrigin(normalized.APP_URL)) failures.push('APP_URL');
  if (env.NODE_ENV !== 'production') failures.push('NODE_ENV');
  if (env.DATABASE_MIGRATION_URL) failures.push('DATABASE_MIGRATION_URL_must_be_absent');
  if (!verifiedDatabaseUrl(env.DATABASE_URL)) failures.push('DATABASE_URL_requires_verified_TLS');
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') failures.push('TLS_verification_disabled');
  if (env.STORAGE_PROVIDER !== 'supabase') failures.push('STORAGE_PROVIDER_requires_durable_supabase');
  if (env.TRUST_PROXY !== 'true') failures.push('TRUST_PROXY');
  const port = Number(env.PORT || 10000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) failures.push('PORT');
  return { env: normalized, port, failures };
}

/** Match direct or shared-session-pooler URLs to the explicitly selected project. */
export function migrationEnvironment(env) {
  const failures = [];
  let project;
  try {
    const supabase = new URL(env.SUPABASE_URL);
    if (supabase.protocol === 'https:' && /^[a-z0-9]+\.supabase\.co$/.test(supabase.hostname)) project = supabase.hostname.split('.')[0];
  } catch { /* Report only setting names. */ }
  if (!project) failures.push('SUPABASE_URL');
  const urls = [];
  for (const name of ['DATABASE_URL', 'DATABASE_MIGRATION_URL']) {
    if (!verifiedDatabaseUrl(env[name])) { failures.push(name); continue; }
    const url = new URL(env[name]);
    urls.push(url);
    const direct = url.hostname === `db.${project}.supabase.co`;
    const session = url.hostname.endsWith('.pooler.supabase.com') && (url.port || '5432') === '5432'
      && decodeURIComponent(url.username).endsWith(`.${project}`);
    if (!direct && !session) failures.push(`${name}_project_or_session_pooler`);
  }
  if (urls.length === 2 && (urls[0].pathname !== urls[1].pathname || urls[0].username === urls[1].username)) failures.push('database_target_or_owner_separation');
  if (!/^[a-z_][a-z0-9_]*$/.test(env.DATABASE_RUNTIME_ROLE || '') || ['postgres', 'root'].includes(env.DATABASE_RUNTIME_ROLE)) failures.push('DATABASE_RUNTIME_ROLE');
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') failures.push('TLS_verification_disabled');
  return failures;
}

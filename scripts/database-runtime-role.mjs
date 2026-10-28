/** A connection-pooler login name can differ from the actual PostgreSQL role. */
export function databaseRuntimeRole(connectionString, explicitRole) {
  let url;
  try { url = new URL(connectionString); } catch { throw new Error('DATABASE_URL must be a PostgreSQL connection URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL.');
  let login;
  try { login = decodeURIComponent(url.username); } catch { throw new Error('Invalid runtime login encoding.'); }
  const role = explicitRole || login;
  if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error('Invalid runtime role name. For a pooled login, set DATABASE_RUNTIME_ROLE to the actual restricted PostgreSQL role.');
  return role;
}

import { createHash } from 'node:crypto';
import { themeBootstrap } from '../../website/tracelab/theme-bootstrap.js';

export const themeBootstrapHash = createHash('sha256').update(themeBootstrap).digest('base64');

/** Dynamic styles remain allowed because graph coordinates and React use them.
 * Executable inline scripts require the exact bootstrap hash or a fresh nonce. */
export function documentCsp({ nonce, development = false }: { nonce?: string; development?: boolean } = {}) {
  if (nonce !== undefined && !/^[a-zA-Z0-9+/]{20,}={0,2}$/.test(nonce)) throw new Error('Invalid CSP nonce');
  const script = nonce ? `'nonce-${nonce}'` : `'sha256-${themeBootstrapHash}'`;
  return ["default-src 'self'", `script-src 'self' ${script}${development ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:",
    `connect-src 'self'${development ? ' ws: wss:' : ''}`, "media-src 'self' blob:", "worker-src 'self' blob:",
    "manifest-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"].join('; ');
}

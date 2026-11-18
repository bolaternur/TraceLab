import { publicOrigin } from './production-environment.mjs';

export const publicIndexPaths = Object.freeze(['/', '/features', '/about', '/faq', '/contact', '/privacy-policy']);
export const excludedIndexPaths = Object.freeze(['/workspace', '/auth', '/account', '/join', '/onboarding', '/demo', '/app', '/api', '/offline', '/_presentation', '/research', '/materials', '/showcase', '/docs']);

export function searchIndexPolicy(env) {
  const origin = publicOrigin(env.APP_URL || env.RENDER_EXTERNAL_URL);
  const enabled = env.INDEX_PUBLIC_SITE === 'true' && Boolean(origin);
  return { enabled, origin, paths: enabled ? [...publicIndexPaths] : [] };
}

export function applyPublicIndexMetadata(html, pagePath, env) {
  const policy = searchIndexPolicy(env);
  if (!policy.enabled || !policy.paths.includes(pagePath)) return html;
  const canonical = new URL(pagePath, policy.origin).href;
  return html.replace('<meta name="robots" content="noindex,nofollow">', '<meta name="robots" content="index,follow">')
    .replace('</head>', `<link rel="canonical" href="${canonical}"></head>`);
}

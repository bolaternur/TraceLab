import type { MetadataRoute } from 'next';
import { excludedIndexPaths, searchIndexPolicy } from '../../scripts/search-index-policy.mjs';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const policy = searchIndexPolicy(process.env);
  if (!policy.enabled || !policy.origin) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: [...excludedIndexPaths] },
    sitemap: new URL('/sitemap.xml', policy.origin).href,
  };
}

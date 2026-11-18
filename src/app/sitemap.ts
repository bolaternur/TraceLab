import type { MetadataRoute } from 'next';
import { searchIndexPolicy } from '../../scripts/search-index-policy.mjs';

export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  const policy = searchIndexPolicy(process.env);
  if (!policy.origin) return [];
  return policy.paths.map(path => ({ url: new URL(path, policy.origin!).href }));
}

export declare const publicIndexPaths: readonly string[];
export declare const excludedIndexPaths: readonly string[];
export function searchIndexPolicy(env: Record<string, string | undefined>): { enabled: boolean; origin: string | null; paths: string[] };
export function applyPublicIndexMetadata(html: string, pagePath: string, env: Record<string, string | undefined>): string;

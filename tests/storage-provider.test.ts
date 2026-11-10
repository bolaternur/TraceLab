import { afterEach, describe, expect, it, vi } from 'vitest';
import { configuredStorage, storage } from '../src/server/storage';
import { mediaStorage, PrivateSupabaseStorage } from '../src/server/workspace-media-storage';

afterEach(() => vi.unstubAllGlobals());

describe('shared durable private storage', () => {
  it('legacy and workspace entry points share one lifecycle-fenced provider', () => {
    expect(mediaStorage).toBe(storage);
    expect(configuredStorage({ STORAGE_PROVIDER: 'supabase', SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'unit-test-only-key', SUPABASE_STORAGE_BUCKET: 'private' })).toBeInstanceOf(PrivateSupabaseStorage);
  });
  it('missing cloud configuration and unknown providers never select local disk', () => {
    expect(() => configuredStorage({ STORAGE_PROVIDER: 'supabase' })).toThrow('storage_not_configured');
    expect(() => configuredStorage({ STORAGE_PROVIDER: 'unrecognized' })).toThrow('storage_not_configured');
  });
  it('cloud failures propagate rather than reading or writing ephemeral files', async () => {
    const transport = vi.fn(async () => new Response('', { status: 503 }));
    vi.stubGlobal('fetch', transport);
    const selected = configuredStorage({ STORAGE_PROVIDER: 'supabase', SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'unit-test-only-key', SUPABASE_STORAGE_BUCKET: 'private' });
    await expect(selected.get('team/file.png')).rejects.toThrow('storage_unavailable');
    await expect(selected.put('team/file.png', Buffer.from('test'), 'image/png')).rejects.toThrow('storage_unavailable');
    expect(transport).toHaveBeenCalledTimes(2);
  });
});

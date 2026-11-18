import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { documentCsp, themeBootstrapHash } from '../src/lib/document-csp';
import { themeBootstrap } from '../website/tracelab/theme-bootstrap.js';
import { NextRequest } from 'next/server';
import { proxy } from '../src/proxy';

describe('active document CSP', () => {
  it('allows only the exact static bootstrap while keeping graph styles and private media usable', () => {
    const policy = documentCsp();
    expect(themeBootstrapHash).toBe(createHash('sha256').update(themeBootstrap).digest('base64'));
    expect(policy.split('; ').find(part=>part.startsWith('script-src '))).toBe(`script-src 'self' 'sha256-${themeBootstrapHash}'`);
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("media-src 'self' blob:");
    expect(policy).not.toContain('unsafe-eval');
  });
  it('never trusts a caller nonce, generates fresh values and forwards the same policy for Next rendering', () => {
    const request = new NextRequest('https://example.test/auth', { headers: { 'x-iznera-nonce': 'attacker-value', 'Content-Security-Policy': "script-src * 'unsafe-inline'" } });
    const first = proxy(request), second = proxy(request);
    const nonce = first.headers.get('x-middleware-request-x-iznera-nonce');
    const policy = first.headers.get('Content-Security-Policy');
    expect(nonce).toMatch(/^[a-zA-Z0-9+/]{32}$/);
    expect(policy).toContain(`'nonce-${nonce}'`);
    expect(policy?.split('; ').find(part=>part.startsWith('script-src '))).not.toContain('unsafe-inline');
    expect(first.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
    expect(second.headers.get('x-middleware-request-x-iznera-nonce')).not.toBe(nonce);
  });
});

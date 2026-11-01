import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { documentCsp } from './lib/document-csp';

// These routes are dynamic Next documents. The generated static workspace uses
// a hash-based policy in next.config.ts instead of a per-request nonce.
export function proxy(request: NextRequest) {
  const nonce = randomBytes(24).toString('base64');
  const policy = documentCsp({ nonce, development: process.env.NODE_ENV !== 'production' });
  const headers = new Headers(request.headers);
  headers.set('x-iznera-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = { matcher: ['/auth/:path*', '/account/:path*', '/join/:path*', '/onboarding/:path*', '/workspace/model/:path*'] };

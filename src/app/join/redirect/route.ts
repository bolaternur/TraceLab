import { NextResponse } from "next/server";

export function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").trim();
  if (!code || !/^[A-Za-z0-9_-]{4,64}$/.test(code)) return NextResponse.redirect(new URL("/onboarding", url.origin));
  return NextResponse.redirect(new URL(`/join/${encodeURIComponent(code)}`, url.origin));
}

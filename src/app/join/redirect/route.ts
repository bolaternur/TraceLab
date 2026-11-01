import { NextResponse } from "next/server";

export function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").trim();
  if (!code || code.length>64 || !/^[A-Za-z0-9_\s-]+$/.test(code)) return NextResponse.redirect(new URL("/join", url.origin));
  return NextResponse.redirect(new URL(`/join/${encodeURIComponent(code)}`, url.origin));
}

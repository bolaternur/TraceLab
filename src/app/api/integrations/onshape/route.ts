import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sourceConnections } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { encryptSecret } from "@/server/storage";
import { audit } from "@/server/audit";

export const runtime = "nodejs";

const AUTH_URL = "https://oauth.onshape.com/oauth/authorize";
const TOKEN_URL = "https://oauth.onshape.com/oauth/token";

/**
 * Onshape OAuth 2.0 (authorization code). GET ?start=1 begins the flow; GET ?code=...&state=... completes it.
 * Requires ONSHAPE_CLIENT_ID / ONSHAPE_CLIENT_SECRET. State is bound to an httpOnly cookie to prevent CSRF.
 */
export async function GET(req: Request) {
  const clientId = process.env.ONSHAPE_CLIENT_ID;
  const clientSecret = process.env.ONSHAPE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL ?? new URL(req.url).origin;
  if (!clientId || !clientSecret) return NextResponse.redirect(`${appUrl}/app/integrations?error=onshape_not_configured`);
  const ctx = await requireTeam();
  const url = new URL(req.url);
  const jar = await cookies();
  if (url.searchParams.get("start")) {
    const state = randomBytes(16).toString("base64url");
    jar.set("pt_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIES !== "true", path: "/", maxAge: 600 });
    const redirect = new URL(AUTH_URL);
    redirect.searchParams.set("response_type", "code");
    redirect.searchParams.set("client_id", clientId);
    redirect.searchParams.set("redirect_uri", `${appUrl}/api/integrations/onshape`);
    redirect.searchParams.set("scope", "OAuth2Read");
    redirect.searchParams.set("state", state);
    return NextResponse.redirect(redirect.toString());
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = jar.get("pt_oauth_state")?.value;
  jar.delete("pt_oauth_state");
  if (!code || !state || !expected || state !== expected) return NextResponse.redirect(`${appUrl}/app/integrations?error=oauth_state`);
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${appUrl}/api/integrations/onshape` }),
  });
  if (!tokenRes.ok) return NextResponse.redirect(`${appUrl}/app/integrations?error=oauth_token`);
  const token = (await tokenRes.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  const existing = await db.select().from(sourceConnections).where(and(eq(sourceConnections.teamId, ctx.team.id), eq(sourceConnections.provider, "onshape"))).limit(1);
  const enc = encryptSecret(JSON.stringify({ webhookSecret: randomBytes(24).toString("hex"), token: token.access_token, refreshToken: token.refresh_token ?? null, expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000 }));
  if (existing[0]) await db.update(sourceConnections).set({ status: "active", encryptedSecret: enc, lastError: null }).where(eq(sourceConnections.id, existing[0].id));
  else await db.insert(sourceConnections).values({ teamId: ctx.team.id, provider: "onshape", label: "Onshape", status: "active", encryptedSecret: enc, createdBy: ctx.user.id });
  await audit({ teamId: ctx.team.id, actorUserId: ctx.user.id, action: "source.connected", metadata: { provider: "onshape", via: "oauth" } });
  return NextResponse.redirect(`${appUrl}/app/integrations?connected=onshape`);
}

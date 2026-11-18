import { NextResponse } from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Onshape remains gated until scoped OAuth lifecycle and provider checks exist.
 * Do not revive the old token exchange by merely filling environment variables. */
export async function GET(){
  return NextResponse.json({error:{code:"integration_not_configured"}},{status:501,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
}

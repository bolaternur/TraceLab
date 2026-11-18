import {createHash,randomBytes} from "node:crypto";
import {z} from "zod";

const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
export const inviteCreation=z.union([
  z.object({kind:z.literal("team_code"),maxUses:z.number().int().min(2).max(200).default(50),expiresInDays:z.number().int().min(1).max(30).default(14)}).strict(),
  z.object({kind:z.literal("individual").optional(),email:z.string().trim().toLowerCase().email().max(254).optional(),role:z.literal("member").optional()}).strict(),
]);

/** Twelve uniform random symbols provide 60 bits; presentation separators are not secret. */
export function newTeamInviteCode(){
  const canonical=[...randomBytes(12)].map(value=>alphabet[value&31]).join("");
  return {code:canonical.match(/.{4}/g)!.join("-"),codeHash:digest("team-code:"+canonical)};
}
export function parseInviteToken(value:unknown){
  const token=z.string().trim().min(1).max(128).parse(value);
  // Existing link tokens are case-sensitive and may contain both '-' and '_'.
  if(/^[A-Za-z0-9_-]{43}$/.test(token))return {kind:"individual" as const,codeHash:digest(token)};
  const canonical=token.replace(/[\s-]/g,"").toUpperCase();
  z.string().regex(/^[A-HJ-NP-Z2-9]{12}$/).parse(canonical);
  return {kind:"team_code" as const,codeHash:digest("team-code:"+canonical)};
}

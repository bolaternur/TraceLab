import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export class SourceError extends Error {
  constructor(public code: string, public status = 422) { super(code); this.name = "SourceError"; }
}
export const GITHUB_MAX_BYTES = 256 * 1024;
export const githubRepository = z.string().regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})\/[a-zA-Z0-9_.-]{1,100}$/);
const sha = z.string().regex(/^[a-fA-F0-9]{40}$/);
const repo = z.object({ full_name: githubRepository });
const commit = z.object({
  id: sha, message: z.string().min(1).max(10000), timestamp: z.iso.datetime({ offset: true }),
  author: z.object({ name: z.string().max(160).optional(), username: z.string().max(80).optional() }),
});
export const githubPush = z.object({
  repository: repo, ref: z.string().regex(/^refs\/(heads|tags)\/[^\s\x00-\x1f]{1,220}$/),
  before: sha, after: sha, deleted: z.boolean().default(false), forced: z.boolean().default(false),
  sender: z.object({ login: z.string().max(80), id: z.number().int().nonnegative() }).optional(),
  commits: z.array(commit).max(100),
});
export type GithubPush = z.infer<typeof githubPush>;
export type GithubPayload = { kind: "push"; data: GithubPush } | { kind: "ping"; data: {repository:{full_name:string}} };
export function parseGithubPayload(event: string | null, raw: Uint8Array, repository: string): GithubPayload {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal:true }).decode(raw)); }
  catch { throw new SourceError("invalid_payload"); }
  const parsed: GithubPayload = event === "push" ? { kind:"push",data:githubPush.parse(value) }
    : event === "ping" ? {kind:"ping",data:z.object({repository:repo}).parse(value)}
    : (()=>{throw new SourceError("unsupported_event");})();
  if(parsed.data.repository.full_name.toLowerCase()!==repository.toLowerCase())throw new SourceError("repository_mismatch",403);
  if(parsed.kind==="push" && new Set(parsed.data.commits.map(c=>c.id.toLowerCase())).size!==parsed.data.commits.length)
    throw new SourceError("duplicate_commit");
  return parsed;
}
export function verifyGithubSignature(raw: Uint8Array, signature: string | null, secret: string) {
  if(!signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature))throw new SourceError("invalid_signature",401);
  const expected=createHmac("sha256",secret).update(raw).digest(),actual=Buffer.from(signature.slice(7),"hex");
  if(!timingSafeEqual(expected,actual))throw new SourceError("invalid_signature",401);
}
export async function readGithubBody(request:Request) {
  if(!(request.headers.get("content-type")||"").toLowerCase().startsWith("application/json"))throw new SourceError("content_type",415);
  const declared=Number(request.headers.get("content-length"));
  if(Number.isFinite(declared)&&declared>GITHUB_MAX_BYTES)throw new SourceError("payload_too_large",413);
  if(!request.body)throw new SourceError("invalid_payload");
  const reader=request.body.getReader(),parts:Uint8Array[]=[];let length=0;
  try { while(true){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.length;
    if(length>GITHUB_MAX_BYTES){await reader.cancel();throw new SourceError("payload_too_large",413);}parts.push(chunk.value);}
  } finally {reader.releaseLock();}
  return Buffer.concat(parts,length);
}
export const sourceCommand=z.discriminatedUnion("command",[
  z.object({command:z.literal("create"),projectId:z.string().uuid(),requestId:z.string().uuid(),repository:githubRepository,label:z.string().trim().min(1).max(120)}).strict(),
  z.object({command:z.enum(["rotate","disconnect"]),projectId:z.string().uuid(),connectionId:z.string().uuid()}).strict(),
  z.object({command:z.literal("retry"),projectId:z.string().uuid(),connectionId:z.string().uuid(),deliveryId:z.string().uuid()}).strict(),
]);

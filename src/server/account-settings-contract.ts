import { z } from "zod";
import { accountLocale } from "./account-contract";

export const accountProfileInput=z.object({
  displayName:z.string().trim().min(1).max(80).refine(value=>!/[\u0000-\u001f\u007f]/u.test(value)),
  locale:accountLocale,
}).strict();
export const accountSessionInput=z.discriminatedUnion("action",[
  z.object({action:z.literal("revoke_one"),sessionId:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
  z.object({action:z.literal("revoke_others")}).strict(),
  z.object({action:z.literal("revoke_all")}).strict(),
]);
export type AccountProfile={displayName:string;locale:"ru"|"en"|"kk";email:string};
export type AccountSessionView={id:string;current:boolean;createdAt:string;expiresAt:string};
export type AccountSettings={profile:AccountProfile;sessions:AccountSessionView[];hasMore:boolean};

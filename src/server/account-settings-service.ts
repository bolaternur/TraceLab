import type { PoolClient } from "pg";
import { pool } from "@/db";
import { AccountError } from "./account-contract";
import { accountProfileInput, accountSessionInput, type AccountSettings } from "./account-settings-contract";

type Identity={userId:string;sessionHash:string};
type ProfileRow={display_name:string;locale:"ru"|"en"|"kk";email:string};
async function authenticated<T>(identity:Identity,work:(client:PoolClient,profile:ProfileRow)=>Promise<T>){
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    // The user lock serializes these operations with session issuance and reset.
    const row=(await client.query<ProfileRow>(`SELECT u.display_name,u.locale,u.email FROM users u
      JOIN account_verification v ON v.user_id=u.id AND v.verified_at IS NOT NULL
      WHERE u.id=$1 FOR UPDATE OF u`,[identity.userId])).rows[0];
    const active=await client.query("SELECT id FROM sessions WHERE id=$1 AND user_id=$2 AND expires_at>now()",[identity.sessionHash,identity.userId]);
    if(!row||!active.rowCount)throw new AccountError("unauthenticated",401);
    const result=await work(client,row);await client.query("COMMIT");return result;
  }catch(error){await client.query("ROLLBACK");throw error;}
  finally{client.release();}
}
export async function getAccountSettings(identity:Identity):Promise<AccountSettings>{
  return authenticated(identity,async(client,profile)=>{
    const rows=(await client.query<{id:string;created_at:Date;expires_at:Date}>(`SELECT id,created_at,expires_at FROM sessions
      WHERE user_id=$1 AND expires_at>now() ORDER BY (id=$2) DESC,created_at DESC,id DESC LIMIT 101`,[identity.userId,identity.sessionHash])).rows;
    return {profile:{displayName:profile.display_name,locale:profile.locale,email:profile.email},
      // Stored IDs are SHA-256 digests, never bearer-cookie values. The digest is
      // only a management reference: authentication hashes an incoming cookie again.
      sessions:rows.slice(0,100).map(row=>({id:row.id,current:row.id===identity.sessionHash,createdAt:row.created_at.toISOString(),expiresAt:row.expires_at.toISOString()})),hasMore:rows.length>100};
  });
}
export async function updateAccountProfile(identity:Identity,raw:unknown){
  const input=accountProfileInput.parse(raw);
  return authenticated(identity,async(client,profile)=>{
    await client.query("UPDATE users SET display_name=$1,locale=$2 WHERE id=$3",[input.displayName,input.locale,identity.userId]);
    return {displayName:input.displayName,locale:input.locale,email:profile.email};
  });
}
export async function revokeAccountSessions(identity:Identity,raw:unknown){
  const input=accountSessionInput.parse(raw);
  return authenticated(identity,async client=>{
    const condition=input.action==="revoke_one"?" AND id=$2":input.action==="revoke_others"?" AND id<>$2":"";
    const args=input.action==="revoke_one"?[identity.userId,input.sessionId]:input.action==="revoke_others"?[identity.userId,identity.sessionHash]:[identity.userId];
    const result=await client.query("DELETE FROM sessions WHERE user_id=$1"+condition,args);
    return {revoked:result.rowCount??0,signedOut:input.action==="revoke_all"||(input.action==="revoke_one"&&input.sessionId===identity.sessionHash)};
  });
}

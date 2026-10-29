import { randomUUID,randomBytes } from "node:crypto";
import { beforeAll,afterAll,describe,expect,it } from "vitest";
import { Pool } from "pg";
import { accountHash } from "@/server/account-contract";

const enabled=process.env.RUN_ACCOUNT_SETTINGS_DB_TESTS==="true"&&Boolean(process.env.DATABASE_URL&&process.env.DATABASE_MIGRATION_URL);
describe.skipIf(!enabled)("own-account settings against PostgreSQL",()=>{
  let service:typeof import("@/server/account-settings-service");
  const owner=new Pool({connectionString:process.env.DATABASE_MIGRATION_URL});
  const people=[randomUUID(),randomUUID(),randomUUID()];
  const tokens=Array.from({length:6},()=>randomBytes(32).toString("base64url"));
  const ids=tokens.map(accountHash),identity={userId:people[0],sessionHash:ids[0]};
  beforeAll(async()=>{
    const database=(await owner.query<{name:string}>("SELECT current_database() AS name")).rows[0].name;
    if(!/^tracelab_unified_(dev_20261026|test(?:_.*)?)$/.test(database))throw new Error("Use the isolated Iznera DB for account settings tests.");
    service=await import("@/server/account-settings-service");
    for(const [index,id]of people.entries()){
      await owner.query("INSERT INTO users(id,email,password_hash,display_name,locale) VALUES($1,$2,'synthetic-no-login','Settings fixture','en')",[id,`settings-${id}@example.test`]);
      await owner.query("INSERT INTO account_verification(user_id,verified_at) VALUES($1,$2)",[id,index===2?null:new Date()]);
    }
    for(const [index,id]of ids.entries())await owner.query("INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$2,now()+$3::interval)",[id,index===4?people[1]:index===5?people[2]:people[0],index===3?"-1 day":"1 day"]);
  });
  afterAll(async()=>{for(const id of people)await owner.query("DELETE FROM users WHERE id=$1 AND email=$2",[id,`settings-${id}@example.test`]);await owner.end();});
  it("lists only own active sessions and does not return bearer tokens",async()=>{
    const result=await service.getAccountSettings(identity);
    expect(result.sessions).toHaveLength(3);expect(result.sessions[0].current).toBe(true);
    expect(result.sessions.some(row=>row.id===ids[4]||row.id===ids[3])).toBe(false);
    expect(tokens.some(token=>JSON.stringify(result).includes(token))).toBe(false);
    expect(result.profile.email).toBe(`settings-${people[0]}@example.test`);
  });
  it("persists locale and display name without allowing email or role changes",async()=>{
    await service.updateAccountProfile(identity,{displayName:"  Әлия — автор  ",locale:"kk"});
    expect((await service.getAccountSettings(identity)).profile).toMatchObject({displayName:"Әлия — автор",locale:"kk"});
    await expect(service.updateAccountProfile(identity,{displayName:"Intrusion",locale:"en",platformRole:"platform_admin"})).rejects.toThrow();
    expect((await owner.query<{platform_role:string}>("SELECT platform_role FROM users WHERE id=$1",[people[0]])).rows[0].platform_role).toBe("user");
  });
  it("cannot revoke another account's session and single revocation is idempotent",async()=>{
    expect(await service.revokeAccountSessions(identity,{action:"revoke_one",sessionId:ids[4]})).toEqual({revoked:0,signedOut:false});
    expect((await owner.query("SELECT id FROM sessions WHERE id=$1",[ids[4]])).rowCount).toBe(1);
    expect(await service.revokeAccountSessions(identity,{action:"revoke_one",sessionId:ids[1]})).toEqual({revoked:1,signedOut:false});
    expect((await service.revokeAccountSessions(identity,{action:"revoke_one",sessionId:ids[1]})).revoked).toBe(0);
  });
  it("revoke others retains this session and foreign sessions",async()=>{
    const result=await service.revokeAccountSessions(identity,{action:"revoke_others"});expect(result.signedOut).toBe(false);expect(result.revoked).toBe(2);
    expect((await service.getAccountSettings(identity)).sessions).toHaveLength(1);
    expect((await owner.query("SELECT id FROM sessions WHERE id=$1",[ids[4]])).rowCount).toBe(1);
  });
  it("fresh checks reject revoked or unverified sessions before any profile write",async()=>{
    await expect(service.updateAccountProfile({...identity,sessionHash:ids[1]},{displayName:"No",locale:"ru"})).rejects.toMatchObject({code:"unauthenticated"});
    await expect(service.getAccountSettings({userId:people[2],sessionHash:ids[5]})).rejects.toMatchObject({code:"unauthenticated"});
    expect((await service.getAccountSettings(identity)).profile.displayName).toBe("Әлия — автор");
  });
  it("revoking all ends this session without deleting other accounts or team data",async()=>{
    expect(await service.revokeAccountSessions(identity,{action:"revoke_all"})).toEqual({revoked:1,signedOut:true});
    await expect(service.getAccountSettings(identity)).rejects.toMatchObject({code:"unauthenticated"});
    expect((await owner.query("SELECT id FROM sessions WHERE id=$1",[ids[4]])).rowCount).toBe(1);
    expect((await owner.query("SELECT id FROM users WHERE id=ANY($1::uuid[])",[people])).rowCount).toBe(3);
  });
});

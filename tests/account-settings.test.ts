import { describe,expect,it } from "vitest";
import { accountProfileInput,accountSessionInput } from "@/server/account-settings-contract";
import { settingsCopy } from "@/app/account/account-settings-copy";

describe("account settings contracts",()=>{
  it("accepts a trimmed student name and exactly the supported locale",()=>{
    expect(accountProfileInput.parse({displayName:"  Әлия  ",locale:"kk"})).toEqual({displayName:"Әлия",locale:"kk"});
    for(const value of [{displayName:"",locale:"ru"},{displayName:"Name\nInjected",locale:"ru"},{displayName:"Name",locale:"de"},{displayName:"Name",locale:"en",platformRole:"platform_admin"},{displayName:"Name",locale:"en",email:"changed@example.test"}])expect(()=>accountProfileInput.parse(value)).toThrow();
  });
  it("accepts only scoped revocation actions, never arbitrary user IDs or raw cookie tokens",()=>{
    expect(accountSessionInput.parse({action:"revoke_one",sessionId:"a".repeat(64)}).action).toBe("revoke_one");
    expect(accountSessionInput.parse({action:"revoke_others"})).toEqual({action:"revoke_others"});
    expect(accountSessionInput.parse({action:"revoke_all"})).toEqual({action:"revoke_all"});
    for(const value of [{action:"revoke_one",sessionId:"bearer-token"},{action:"revoke_all",userId:"other-user"},{action:"delete_user"}])expect(()=>accountSessionInput.parse(value)).toThrow();
  });
  it("all account settings labels exist in all three locales",()=>{
    const keys=Object.keys(settingsCopy.en).sort();
    for(const copy of Object.values(settingsCopy)){expect(Object.keys(copy).sort()).toEqual(keys);expect(Object.values(copy).every(value=>value.trim().length>0)).toBe(true);}
  });
});

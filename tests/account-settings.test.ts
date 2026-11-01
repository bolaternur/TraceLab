import { describe,expect,it } from "vitest";
import { accountProfileInput,accountSessionInput } from "@/server/account-settings-contract";
import { settingsCopy,accountDataCopy } from "@/app/account/account-settings-copy";
import { lifecycleCopy } from "@/app/account/lifecycle-copy";
import { formatAccountDate } from "@/lib/account-date";

describe("account settings contracts",()=>{
  it("uses deterministic UTC deadlines when browser ICU lacks Kazakh month names",()=>{
    const value='2026-10-28T23:39:34-05:00';
    expect(formatAccountDate(value,'kk')).toBe('29 қазан 2026 ж., 04:39 UTC');
    expect(formatAccountDate(value,'ru')).toBe('29 окт. 2026 г., 04:39 UTC');
    expect(formatAccountDate(value,'en')).toBe('Oct 29, 2026, 04:39 UTC');
    expect(formatAccountDate('invalid','kk')).toBe('—');
  });
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
    for(const dictionary of [settingsCopy,accountDataCopy,lifecycleCopy]){const keys=Object.keys(dictionary.en).sort();
    for(const copy of Object.values(dictionary)){expect(Object.keys(copy).sort()).toEqual(keys);expect(Object.values(copy).every(value=>typeof value==='string'&&value.trim().length>0)).toBe(true);}}
  });
});

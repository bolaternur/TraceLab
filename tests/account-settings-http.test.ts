import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { accountHash } from "@/server/account-contract";
const state=vi.hoisted(()=>({user:{id:"own-user"} as {id:string}|null,cookies:new Map<string,string>()}));
const service=vi.hoisted(()=>({getAccountSettings:vi.fn(),revokeAccountSessions:vi.fn(),updateAccountProfile:vi.fn()}));
vi.mock("@/server/auth",()=>({getCurrentUser:async()=>state.user}));
vi.mock("@/server/account-settings-service",()=>service);
vi.mock("@/server/account-http",()=>({accountResponse:(body:unknown,status=200)=>Response.json(body,{status})}));
vi.mock("next/headers",()=>({cookies:async()=>({get:(key:string)=>state.cookies.has(key)?{value:state.cookies.get(key)}:undefined,delete:(key:string)=>state.cookies.delete(key),set:(key:string,value:string)=>state.cookies.set(key,value)})}));
import { POST as revoke } from "@/app/api/account/sessions/route";
import { PATCH as profile } from "@/app/api/account/profile/route";

const request=(path:string,body:unknown,origin="http://localhost:3000",method="POST")=>new Request("http://localhost:3000/api/account/"+path,{method,headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(body)});
describe("account settings HTTP authorization",()=>{
  beforeEach(()=>{vi.stubEnv("APP_URL","http://localhost:3000");vi.stubEnv("NODE_ENV","test");vi.clearAllMocks();state.user={id:"own-user"};state.cookies.clear();state.cookies.set("pt_session","synthetic-bearer-token");state.cookies.set("pt_team","team");});
  afterEach(()=>vi.unstubAllEnvs());
  it("rejects cross-origin session and profile mutations before service access",async()=>{
    expect((await revoke(request("sessions",{action:"revoke_all"},"https://foreign.example"))).status).toBe(403);
    expect((await profile(request("profile",{displayName:"No",locale:"en"},"https://foreign.example","PATCH"))).status).toBe(403);
    expect(service.revokeAccountSessions).not.toHaveBeenCalled();expect(service.updateAccountProfile).not.toHaveBeenCalled();
  });
  it("rejects a missing authenticated user",async()=>{
    state.user=null;
    expect((await revoke(request("sessions",{action:"revoke_all"}))).status).toBe(401);
    expect(service.revokeAccountSessions).not.toHaveBeenCalled();
  });
  it("derives identity from the cookie and clears current cookies only when signed out",async()=>{
    service.revokeAccountSessions.mockResolvedValue({revoked:2,signedOut:true});
    const response=await revoke(request("sessions",{action:"revoke_all"}));expect(response.status).toBe(200);
    expect(service.revokeAccountSessions).toHaveBeenCalledWith({userId:"own-user",sessionHash:accountHash("synthetic-bearer-token")},{action:"revoke_all"});
    expect(state.cookies.has("pt_session")).toBe(false);expect(state.cookies.has("pt_team")).toBe(false);
  });
  it("persists the returned profile locale cookie without exposing a bearer token",async()=>{
    service.updateAccountProfile.mockResolvedValue({displayName:"Әлия",locale:"kk",email:"person@example.test"});
    const response=await profile(request("profile",{displayName:"Әлия",locale:"kk"},undefined,"PATCH"));
    expect(response.status).toBe(200);expect(state.cookies.get("pt_lang")).toBe("kk");expect(await response.text()).not.toContain("synthetic-bearer-token");
  });
});

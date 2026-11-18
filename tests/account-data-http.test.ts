import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { AccountError,accountHash } from "@/server/account-contract";
const state=vi.hoisted(()=>({user:{id:"own-user"} as {id:string}|null,cookies:new Map<string,string>()}));
const exportData=vi.hoisted(()=>vi.fn());
vi.mock("@/server/auth",()=>({getCurrentUser:async()=>state.user}));
vi.mock("@/server/account-data-service",()=>({exportAccountData:exportData}));
vi.mock("@/server/account-http",()=>({accountResponse:(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}})}));
vi.mock("next/headers",()=>({cookies:async()=>({get:(key:string)=>state.cookies.has(key)?{value:state.cookies.get(key)}:undefined})}));
import { GET } from "@/app/api/account/data/route";
beforeEach(()=>{state.user={id:"own-user"};state.cookies.clear();state.cookies.set("pt_session","fixture-bearer-token");exportData.mockReset();});
afterEach(()=>vi.restoreAllMocks());
describe("private own-account JSON download",()=>{
  it("derives the owner from the authenticated cookie, ignores requested IDs and prevents caching",async()=>{
    exportData.mockResolvedValue({format:"iznera-account-data-v1",account:{displayName:"Fixture"}});
    const response=await GET(new Request("https://example.test/api/account/data?userId=other&team=foreign"));
    expect(exportData).toHaveBeenCalledWith({userId:"own-user",sessionHash:accountHash("fixture-bearer-token")});
    expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toContain("no-store");expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(await response.text()).not.toContain("fixture-bearer-token");
  });
  it("rejects unsigned and cross-site requests before fetching private rows",async()=>{
    state.user=null;expect((await GET(new Request("https://example.test/api/account/data"))).status).toBe(401);
    state.user={id:"own-user"};expect((await GET(new Request("https://example.test/api/account/data",{headers:{"Sec-Fetch-Site":"cross-site"}}))).status).toBe(403);
    expect(exportData).not.toHaveBeenCalled();
  });
  it("fails oversized snapshots without a partial successful download and redacts internal errors",async()=>{
    exportData.mockRejectedValue(new AccountError("data_export_too_large",413));expect((await GET(new Request("https://example.test/api/account/data"))).status).toBe(413);
    const error=vi.spyOn(console,"error").mockImplementation(()=>{});exportData.mockRejectedValue(new Error("private fixture database credentials"));
    const response=await GET(new Request("https://example.test/api/account/data"));expect(response.status).toBe(503);expect(await response.text()).not.toContain("private fixture");expect(error.mock.calls.flat().join(" ")).not.toContain("private fixture");
  });
});

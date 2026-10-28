import { beforeEach,describe,expect,it,vi } from "vitest";
const state=vi.hoisted(()=>({id:"current-owner"}));
const media=vi.hoisted(()=>({authorizeMediaUpload:vi.fn(),listWorkspaceMedia:vi.fn(),uploadWorkspaceMedia:vi.fn()}));
vi.mock("@/server/auth",()=>({getCurrentUser:async()=>({id:state.id})}));
vi.mock("@/server/workspace-media-service",()=>media);
vi.mock("@/server/workspace-media-http",()=>({mediaJson:(body:unknown,status=200)=>Response.json(body,{status}),mediaFailure:()=>Response.json({error:{code:"invalid"}},{status:422})}));
import { POST } from "@/app/api/workspace/media/route";
describe("offline media owner binding",()=>{
  beforeEach(()=>{vi.clearAllMocks();});
  it("rejects a draft from another signed-in account before reading or authorizing media",async()=>{
    vi.stubEnv("APP_URL","http://localhost:3000");
    try{
      const response=await POST(new Request("http://localhost:3000/api/workspace/media",{method:"POST",headers:{Origin:"http://localhost:3000","X-TraceLab-Queue-Owner":"previous-owner"},body:"untouched"}));
      expect(response.status).toBe(403);expect(await response.json()).toEqual({error:{code:"queue_owner_mismatch"}});expect(media.authorizeMediaUpload).not.toHaveBeenCalled();expect(media.uploadWorkspaceMedia).not.toHaveBeenCalled();
    }finally{vi.unstubAllEnvs();}
  });
});

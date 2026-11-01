import {describe,it,expect} from "vitest";
import {createHmac} from "node:crypto";
import {githubPush,parseGithubPayload,verifyGithubSignature,readGithubBody,GITHUB_MAX_BYTES,sourceCommand} from "@/server/workspace-sources-contract";
const secret="fixture-only-webhook-secret-32-characters";
export const pushFixture=(overrides:Record<string,unknown>={})=>({repository:{full_name:"test-team/robot",private:true},ref:"refs/heads/main",before:"a".repeat(40),after:"b".repeat(40),deleted:false,forced:false,sender:{login:"external-dev",id:123},commits:[{id:"b".repeat(40),message:"Improve intake\n\nMeasured locally",timestamp:"2026-10-20T12:00:00+05:00",author:{name:"External Developer",username:"external-dev",email:"do-not-store@example.invalid"}}],...overrides});
describe("GitHub metadata contract",()=>{
  it("uses HMAC-SHA256 over exact UTF-8 bytes and rejects missing/tampered/short signatures",()=>{
    const raw=Buffer.from("Казахша ә · Русский · English"),signature="sha256="+createHmac("sha256",secret).update(raw).digest("hex");
    expect(()=>verifyGithubSignature(raw,signature,secret)).not.toThrow();
    for(const wrong of [null,"sha256=bad",signature.replace(/.$/,signature.endsWith("0")?"1":"0")])expect(()=>verifyGithubSignature(raw,wrong,secret)).toThrow();
    expect(()=>verifyGithubSignature(Buffer.from("changed"),signature,secret)).toThrow();
  });
  it("matches the official GitHub signature fixture",()=>{
    expect(()=>verifyGithubSignature(Buffer.from("Hello, World!"),"sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17","It's a Secret to Everybody")).not.toThrow();
  });
  it("retains SHA/branch/actor/time and strips emails/code/unneeded payload",()=>{
    const parsed=parseGithubPayload("push",Buffer.from(JSON.stringify(pushFixture())),"test-team/robot");
    expect(JSON.stringify(parsed)).not.toContain("do-not-store");expect(JSON.stringify(parsed)).not.toContain('"private"');
    expect(parsed.kind).toBe("push");if(parsed.kind==="push"){expect(parsed.data.ref).toBe("refs/heads/main");expect(parsed.data.commits[0].id).toHaveLength(40);}
  });
  it("rejects wrong repository/event, duplicate commits and oversized commit lists instead of truncating",()=>{
    const body=Buffer.from(JSON.stringify(pushFixture()));expect(()=>parseGithubPayload("push",body,"other/repo")).toThrow();expect(()=>parseGithubPayload("pull_request",body,"test-team/robot")).toThrow();
    const first=pushFixture().commits[0];expect(()=>parseGithubPayload("push",Buffer.from(JSON.stringify(pushFixture({commits:[first,first]}))),"test-team/robot")).toThrow();
    expect(githubPush.safeParse(pushFixture({commits:Array(101).fill(first)})).success).toBe(false);
  });
  it("enforces actual streamed bytes even when Content-Length lies",async()=>{
    const request=new Request("http://localhost/hook",{method:"POST",headers:{"Content-Type":"application/json","Content-Length":"2"},body:Buffer.alloc(GITHUB_MAX_BYTES+1)});
    await expect(readGithubBody(request)).rejects.toMatchObject({code:"payload_too_large",status:413});
    await expect(readGithubBody(new Request("http://localhost/hook",{method:"POST",headers:{"Content-Type":"text/plain"},body:"{}"}))).rejects.toMatchObject({status:415});
  });
  it("accepts only explicit bounded repository paths and commands",()=>{
    expect(sourceCommand.safeParse({command:"create",projectId:crypto.randomUUID(),requestId:crypto.randomUUID(),repository:"https://evil.test/a/b",label:"Source"}).success).toBe(false);
    expect(sourceCommand.safeParse({command:"create",projectId:crypto.randomUUID(),requestId:crypto.randomUUID(),repository:"team/robot",label:"Source",token:"unexpected"}).success).toBe(false);
  });
});

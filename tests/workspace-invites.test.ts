import {describe,it,expect} from "vitest";
import {createHash,randomBytes} from "node:crypto";
import {inviteCreation,newTeamInviteCode,parseInviteToken} from "@/server/workspace-invite-contract";
describe("Team invitation contract",()=>{
  it("generates typeable high-entropy codes and matches separators/case without storing presentation text",()=>{
    const codes=new Set<string>();
    for(let index=0;index<128;index++){
      const generated=newTeamInviteCode();codes.add(generated.code);
      expect(generated.code).toMatch(/^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){2}$/);
      expect(generated.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(parseInviteToken(generated.code.toLowerCase().replaceAll("-"," "))).toEqual({kind:"team_code",codeHash:generated.codeHash});
      expect(generated.codeHash).not.toContain(generated.code);
    }
    expect(codes.size).toBe(128);
  });
  it("preserves the exact case-sensitive legacy token hash",()=>{
    const token=randomBytes(32).toString("base64url");
    expect(parseInviteToken(token)).toEqual({kind:"individual",codeHash:createHash("sha256").update(token).digest("hex")});
    expect(parseInviteToken(token.toUpperCase()).codeHash).not.toBe(parseInviteToken(token.toLowerCase()).codeHash);
  });
  it("rejects mistyped/oversized/polluted codes and forbids roles and emails on shared team codes",()=>{
    for(const token of ["ABCD-EFGH-1234","ABCD-EFGH-IJKL","A".repeat(129),"https://evil.test/ABCD-EFGH-JKLM","abcd<script>"])
      expect(()=>parseInviteToken(token)).toThrow();
    for(const values of [{kind:"team_code",role:"coach"},{kind:"team_code",email:"member@example.invalid"},{kind:"team_code",maxUses:201},{kind:"team_code",maxUses:1},{kind:"team_code",expiresInDays:31},{kind:"team_code",expiresInDays:0}])
      expect(inviteCreation.safeParse(values).success).toBe(false);
    expect(inviteCreation.parse({kind:"team_code"})).toEqual({kind:"team_code",maxUses:50,expiresInDays:14});
    expect(inviteCreation.parse({role:"member",email:" MEMBER@example.invalid "})).toEqual({role:"member",email:"member@example.invalid"});
  });
});

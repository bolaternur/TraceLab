import { describe,expect,it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { evaluateReportPolicy, orderedReportRecords, publicManifest, recordWarnings, reportCopy, reportHash, reportInput, reportOutputBudget, reportOutputWithinBudget, type ReportData, type ReportPolicy } from "@/server/workspace-report-model";
import { renderReportHtml,renderReportPdf } from "@/server/workspace-report-render";

const now=new Date("2026-10-26T12:00:00Z");
function fixture():ReportData{
  const record={id:"TEST-01",kind:"test" as const,title:"Ұстау күші · Проверка захвата",body:"Авторлық мәтін өзгертілмейді. Ә Ғ Қ Ң Ө Ұ Ү Һ І — ә ғ қ ң ө ұ ү һ і.\n".repeat(20),author:"Сынақ авторы",createdAt:now.toISOString(),trials:20,successes:17,unit:"рет",conditions:"Жүктеме 180 г"};
  const decision={id:"DEC-02",kind:"decision" as const,title:"Сохранить мягкую накладку",body:"Исходное решение участника.",rationale:"17 из 20 успешных попыток при той же нагрузке.",author:"Автор испытания",createdAt:now.toISOString()};
  return {schemaVersion:1,exportId:randomUUID(),version:1,createdAt:now.toISOString(),creator:{id:randomUUID(),displayName:"Test author"},
    team:{id:randomUUID(),name:"Synthetic QA team",program:"OTHER"},season:{id:randomUUID(),name:"QA 2026"},
    project:{id:randomUUID(),name:"Жоба · Инженерная история",description:"Synthetic rendering fixture",dataKind:"synthetic",educationalOrigin:true,records:[record,decision],links:[{id:"L-01",from:"TEST-01",to:"DEC-02",label:"Supports",status:"accepted"}],studyRows:[]},
    projectSnapshotId:randomUUID(),projectRevision:2,options:reportInput.parse({projectId:randomUUID(),requestId:randomUUID(),locale:"kk",acknowledgeWarnings:true}),
    refs:[record,decision].map(r=>({localId:r.id,canonicalId:randomUUID(),entityType:r.kind,sourceHash:reportHash(r.body),authorUserId:randomUUID(),importedBy:null,originalAuthorLabel:null,annotationId:randomUUID(),annotationHash:reportHash(r.body),sourceOriginal:r,annotationHistory:[]})),media:[],
    policyGate:evaluateReportPolicy(null,"OTHER","QA 2026","engineering"),warnings:[{code:"educational_origin"},{code:"human_privacy_review_required"}],completeness:{selected:2,available:2,complete:true},contentHash:reportHash("synthetic fixture")};
}
const policy:ReportPolicy={id:randomUUID(),profileId:randomUUID(),program:"TEST",season:"fixture-only",version:"fixture-1",status:"active",reviewedAt:now.toISOString(),reviewer:"Automated test fixture; not a real rules review",effectiveFrom:"2026-10-01T00:00:00Z",sourceUrls:["https://example.invalid/rules"],constraints:{validUntil:"2026-11-01T00:00:00Z",maxPages:30,maxFileMb:10},matrix:{export_deterministic_notebook:"ALLOW"}};
describe("report policy and deterministic documents",()=>{
  it("requires reviewed FTC cover/content/decimal byte semantics and a dated content window",()=>{
    const ftc={...policy,program:"FTC"};
    expect(evaluateReportPolicy(ftc,"FTC","fixture-only","competition",now).code).toBe("policy_layout_unreviewed");
    const reviewed={...ftc,constraints:{...policy.constraints,coverPages:1,maxContentPages:15,maxPages:16,maxFileMb:15,fileUnit:"MB",fileLimitExclusive:true}};
    expect(evaluateReportPolicy(reviewed,"FTC","fixture-only","competition",now).code).toBe("policy_content_window_unreviewed");
    expect(evaluateReportPolicy({...reviewed,constraints:{...reviewed.constraints,contentNotBefore:"2026-01-01T00:00:00.000Z"}},"FTC","fixture-only","competition",now).allowed).toBe(true);
  });
  it("preserves explicit order and rejects duplicates, foreign IDs and inconsistent sections",()=>{
    const records=fixture().project.records,ids=records.map(record=>record.id).reverse();
    expect(orderedReportRecords(records,{recordIds:ids}).map(record=>record.id)).toEqual(ids);
    const sections=[{title:"Choice",recordIds:[ids[0]]},{title:"Evidence",recordIds:[ids[1]]}];
    expect(orderedReportRecords(records,{recordIds:ids,sections}).map(record=>record.id)).toEqual(ids);
    for(const recordIds of [[ids[0],ids[0]],["foreign-id"]])expect(()=>orderedReportRecords(records,{recordIds})).toThrow("invalid_report_selection");
    expect(()=>orderedReportRecords(records,{recordIds:ids,sections:[{title:"Reordered",recordIds:[...ids].reverse()}]})).toThrow("invalid_report_sections");
    expect(()=>orderedReportRecords(records,{recordIds:ids,sections:[{title:"Missing",recordIds:[ids[0]]}]})).toThrow("invalid_report_sections");
  });
  it("enforces strict decimal-byte competition budgets and a measured PDF with cover + content",()=>{
    const reviewed={...policy,constraints:{...policy.constraints,maxFileMb:15,fileUnit:"MB",coverPages:1,maxContentPages:15,maxPages:16}};
    const options={purpose:"competition",format:"pdf"} as const;
    expect(reportOutputBudget(options,reviewed)).toMatchObject({bytes:15_000_000,pages:16,contentPages:15,exclusive:true});
    expect(reportOutputWithinBudget({bytes:14_999_999,pages:16},options,reviewed)).toBe(true);
    expect(reportOutputWithinBudget({bytes:15_000_000,pages:16},options,reviewed)).toBe(false);
    expect(reportOutputWithinBudget({bytes:1000,pages:17},options,reviewed)).toBe(false);
    for(const pages of [null,0,1,1.5])expect(reportOutputWithinBudget({bytes:1000,pages},options,reviewed)).toBe(false);
    for(const format of ["html","json"] as const)expect(reportOutputWithinBudget({bytes:1000,pages:2},{...options,format},reviewed)).toBe(false);
  });
  it("keeps the technical manifest separate from a competition PDF, while engineering PDFs keep it attached",async()=>{
    const data=fixture();data.options.purpose="competition";data.options.teamNumber="12345";
    data.policyGate={...evaluateReportPolicy(policy,"TEST","fixture-only","competition",now),policy};
    data.project.records.forEach(record=>{record.body="Synthetic authored evidence. ".repeat(5);});
    const rendered=await renderReportPdf(data);
    expect(rendered.pages).toBeGreaterThanOrEqual(2);
    expect(rendered.bytes.toString("latin1")).not.toContain("iznera-manifest.json");
    expect(publicManifest(data).layout).toMatchObject({purpose:"competition",teamNumber:"12345"});
    expect(publicManifest(data).records).toHaveLength(2);
  });
  it("keeps original engineering export available but fails closed for unknown/stale/mismatched competition policy",()=>{
    expect(evaluateReportPolicy(null,"FTC","2026","engineering").allowed).toBe(true);
    expect(evaluateReportPolicy(null,"FTC","2026","competition").allowed).toBe(false);
    expect(evaluateReportPolicy(policy,"TEST","fixture-only","competition",now).allowed).toBe(true);
    expect(evaluateReportPolicy({...policy,reviewedAt:"2026-08-01T00:00:00Z"},"TEST","fixture-only","competition",now).code).toBe("policy_stale");
    expect(evaluateReportPolicy(policy,"TEST","next-season","competition",now).allowed).toBe(false);
    expect(evaluateReportPolicy({...policy,matrix:{export_deterministic_notebook:"BLOCK"}},"TEST","fixture-only","competition",now).decision).toBe("BLOCK");
    expect(evaluateReportPolicy({...policy,constraints:{}},"TEST","fixture-only","competition",now).allowed).toBe(false);
    for(const maxPages of [Infinity,NaN,-1,0,1.5])expect(evaluateReportPolicy({...policy,constraints:{...policy.constraints,maxPages}},"TEST","fixture-only","competition",now).code).toBe("policy_limits_unreviewed");
    for(const maxFileMb of [Infinity,NaN,-1,0])expect(evaluateReportPolicy({...policy,constraints:{...policy.constraints,maxFileMb}},"TEST","fixture-only","competition",now).code).toBe("policy_limits_unreviewed");
    expect(()=>reportInput.parse({projectId:randomUUID(),requestId:randomUUID(),action:"rewrite_student_text"})).toThrow();
  });
  it("reports missing why/evidence and possible PII without inventing text or hiding educational provenance",()=>{
    const data=fixture();data.project.records[1].rationale="";data.project.records[1].body="Contact author@example.invalid";data.project.links=[];
    const warnings=recordWarnings(data.project.records,data.project,[]).map(w=>w.code);
    expect(warnings).toEqual(expect.arrayContaining(["missing_why","missing_evidence","possible_personal_data","educational_origin","unverified_import_author","human_privacy_review_required"]));
    const manifest=publicManifest(data);expect(manifest.generation).toEqual({method:"deterministic-layout",aiUsed:false,studentTextRewritten:false});
  });
  it("does not treat future work, reversed links, another decision or unaccepted links as decision evidence",()=>{
    const data=fixture(),decision=data.project.records[1];
    data.project.records.push({...decision,id:"ITER-03",kind:"iteration"},{...decision,id:"DEC-04"});
    const cases=[
      {from:"DEC-02",to:"ITER-03",relationType:"IMPLEMENTS",status:"accepted" as const},
      {from:"DEC-02",to:"TEST-01",relationType:"SUPPORTS",status:"accepted" as const},
      {from:"DEC-04",to:"DEC-02",relationType:"SUPPORTS",status:"accepted" as const},
      {from:"TEST-MISSING",to:"DEC-02",relationType:"SUPPORTS",status:"accepted" as const},
      {from:"TEST-01",to:"DEC-02",relationType:"SUPPORTS",status:"suggested" as const},
      {from:"TEST-01",to:"DEC-02",relationType:"SUPPORTS",status:"rejected" as const},
    ];
    for(const link of cases){data.project.links=[{id:"LINK",label:"Evidence",...link}];expect(recordWarnings(data.project.records,data.project,data.refs)).toContainEqual({code:"missing_evidence",recordId:"DEC-02"});}
  });
  it("accepts included directed source/test evidence, but keeps the gap when that evidence is excluded from the report",()=>{
    const data=fixture();
    for(const relationType of [undefined,"RELATED_TO","SUPPORTS","CONTRADICTS","REFERENCES"]){
      data.project.links=[{id:"LINK",from:"TEST-01",to:"DEC-02",label:"Evidence",status:"accepted",relationType}];
      expect(recordWarnings(data.project.records,data.project,data.refs)).not.toContainEqual({code:"missing_evidence",recordId:"DEC-02"});
      expect(recordWarnings([data.project.records[1]],data.project,data.refs)).toContainEqual({code:"missing_evidence",recordId:"DEC-02"});
    }
    for(const relationType of ["DERIVED_FROM","RESPONDS_TO"]){data.project.links=[{id:"LINK",from:"DEC-02",to:"TEST-01",label:"Basis",status:"accepted",relationType}];expect(recordWarnings(data.project.records,data.project,data.refs)).not.toContainEqual({code:"missing_evidence",recordId:"DEC-02"});}
  });
  it("escapes authored HTML and includes a self-contained font/manifest without private storage keys",async()=>{
    const data=fixture();data.project.records[0].body='<script>alert("x")</script><img src="https://example.invalid/leak">';
    data.media=[{id:randomUUID(),recordId:"TEST-01",storageKey:"private/never-expose.bin",mimeType:"model/gltf-binary",bytes:12,sha256:"hash",caption:"Model",alt:"",modelId:randomUUID(),versionLabel:"v1",annotationId:null}];
    const html=await renderReportHtml(data);
    expect(html).not.toContain('<script>');expect(html).toContain("&lt;script&gt;");expect(html).toContain("data:font/ttf;base64,");expect(html).not.toContain("private/never-expose.bin");
    expect(html).toContain(data.refs[0].canonicalId);expect(html).toContain("sourceOriginal");
  });
  it("renders real multipage A4/Letter PDF with attached exact manifest and all locale labels",async()=>{
    for(const paper of ["A4","LETTER"] as const){
      const data=fixture();data.options.paper=paper;
      const picture=await sharp({create:{width:720,height:260,channels:3,background:{r:219,g:228,b:212}}}).png().toBuffer();
      data.media=[{id:"fixture-image",recordId:"DEC-02",storageKey:"fixture/image.png",mimeType:"image/png",bytes:picture.length,sha256:reportHash(picture),caption:"Synthetic image fixture — test only",alt:"Synthetic pale green rectangle",modelId:null,versionLabel:null,annotationId:null}];
      const rendered=await renderReportPdf(data,[{id:"fixture-image",bytes:picture,mimeType:"image/png"}]);
      expect(rendered.bytes.subarray(0,5).toString()).toBe("%PDF-");expect(rendered.pages).toBeGreaterThan(1);
      expect(rendered.bytes.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBe(rendered.pages);
      expect(rendered.bytes.toString("latin1")).toContain("/Subtype /Image");
      expect(rendered.bytes.toString("latin1")).toContain("iznera-manifest.json");expect(rendered.bytes.length).toBeGreaterThan(10_000);
      if(process.env.REPORT_REVIEW_DIR){await mkdir(process.env.REPORT_REVIEW_DIR,{recursive:true});await writeFile(path.join(process.env.REPORT_REVIEW_DIR,`report-${paper}.pdf`),rendered.bytes);}
    }
    for(const locale of ["ru","en","kk"] as const){expect(Object.keys(reportCopy[locale])).toEqual(Object.keys(reportCopy.en));expect(Object.values(reportCopy[locale]).every(Boolean)).toBe(true);}
  });
});

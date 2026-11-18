import { createHash } from "node:crypto";
import { z } from "zod";
import type { WorkspaceProject, WorkspaceRecord } from "../../website/tracelab/workspace-store.js";

export const REPORT_LIMITS = { records:500, bytes:32*1024*1024, pages:250, imageBytes:8*1024*1024, totalImageBytes:24*1024*1024 } as const;
export const reportInput = z.object({
  projectId:z.string().uuid(),requestId:z.string().uuid(),format:z.enum(["pdf","html","json"]).default("pdf"),
  locale:z.enum(["ru","en","kk"]).default("en"),paper:z.enum(["A4","LETTER"]).default("A4"),
  purpose:z.enum(["engineering","competition"]).default("engineering"),
  scope:z.enum(["project","personal","handoff"]).default("project"),
  recordIds:z.array(z.string().min(1).max(100)).max(REPORT_LIMITS.records).optional(),
  sections:z.array(z.object({title:z.string().trim().min(1).max(120),recordIds:z.array(z.string().min(1).max(100)).min(1).max(REPORT_LIMITS.records)}).strict()).max(30).optional(),
  teamNumber:z.string().trim().regex(/^\d{1,8}$/).optional(),
  expectedProjectRevision:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  acknowledgeWarnings:z.boolean().default(false),
}).strict();
export type ReportOptions=z.infer<typeof reportInput>;
export type ReportPolicy={id:string;profileId:string;program:string;season:string;version:string;status:string;reviewedAt:string|null;reviewer:string|null;effectiveFrom:string|null;sourceUrls:string[];constraints:Record<string,unknown>;matrix:Record<string,string>};
export type PolicyGate={decision:"ALLOW"|"ALLOW_WITH_DISCLOSURE"|"REQUIRE_REVIEW"|"BLOCK";allowed:boolean;code:string;policy:ReportPolicy|null};
const policyAnchor=z.object({schemaVersion:z.literal(1),versionId:z.string().uuid().nullable(),profileId:z.string().uuid().nullable(),pinnedAt:z.string().datetime(),reason:z.enum(["season_handoff","new_season_unreviewed"])}).strict();
export function reportPolicySelection(anchor:unknown,present:boolean):{mode:"legacy"|"blocked"|"pinned";versionId?:string;profileId?:string}{
  if(!present)return {mode:"legacy"};
  const result=policyAnchor.safeParse(anchor);
  if(!result.success||result.data.reason==="new_season_unreviewed"||!result.data.versionId||!result.data.profileId)return {mode:"blocked"};
  return {mode:"pinned",versionId:result.data.versionId,profileId:result.data.profileId};
}
export function evaluateReportPolicy(policy:ReportPolicy|null,program:string,season:string,purpose:ReportOptions["purpose"],now=new Date()):PolicyGate {
  const review=(code:string):PolicyGate=>({decision:"REQUIRE_REVIEW",allowed:false,code,policy});
  if(purpose==="engineering")return {decision:"ALLOW_WITH_DISCLOSURE",allowed:true,code:"engineering_not_competition_approval",policy};
  if(!policy)return review("policy_unknown");
  if(policy.status!=="active"||policy.program!==program||policy.season!==season)return review("policy_season_unreviewed");
  if(!policy.reviewer||!policy.reviewedAt||!policy.effectiveFrom||!policy.sourceUrls.length||policy.sourceUrls.some(url=>!/^https:\/\//.test(url)))return review("policy_review_incomplete");
  const reviewed=Date.parse(policy.reviewedAt),effective=Date.parse(policy.effectiveFrom),until=Date.parse(String(policy.constraints.validUntil??""));
  if(!Number.isFinite(reviewed)||!Number.isFinite(effective)||!Number.isFinite(until)||reviewed>+now||effective>+now||until<+now||reviewed<+now-30*86400000)return review("policy_stale");
  const decision=policy.matrix.export_deterministic_notebook;
  if(decision==="BLOCK")return {decision:"BLOCK",allowed:false,code:"policy_export_blocked",policy};
  if(decision!=="ALLOW"&&decision!=="ALLOW_WITH_DISCLOSURE")return review("policy_action_unknown");
  const maxPages=Number(policy.constraints.maxPages),maxFileMb=Number(policy.constraints.maxFileMb);
  if(!Number.isSafeInteger(maxPages)||maxPages<=0||!Number.isFinite(maxFileMb)||maxFileMb<=0)return review("policy_limits_unreviewed");
  if(program==="FTC"&&(!Number.isSafeInteger(policy.constraints.maxContentPages)||Number(policy.constraints.maxContentPages)<1||policy.constraints.coverPages!==1||Number(policy.constraints.maxContentPages)+1!==maxPages||policy.constraints.fileUnit!=="MB"||policy.constraints.fileLimitExclusive!==true))return review("policy_layout_unreviewed");
  const contentStart=String(policy.constraints.contentNotBefore??"");
  if(program==="FTC"&&(!/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(contentStart)||!Number.isFinite(Date.parse(contentStart))))return review("policy_content_window_unreviewed");
  return {decision,allowed:true,code:"reviewed_configuration_not_award_guarantee",policy};
}
/** An explicit record sequence is part of the immutable report snapshot. */
export function orderedReportRecords(records:WorkspaceRecord[],options:Pick<ReportOptions,"recordIds"|"sections">){
  const byId=new Map(records.map(record=>[record.id,record]));
  const ids=options.recordIds??records.map(record=>record.id);
  if(new Set(ids).size!==ids.length||ids.some(id=>!byId.has(id)))throw new Error("invalid_report_selection");
  const selected=ids.map(id=>byId.get(id)!);
  if(options.sections){const sectionIds=options.sections.flatMap(section=>section.recordIds);if(sectionIds.length!==ids.length||new Set(sectionIds).size!==sectionIds.length||sectionIds.some((id,index)=>id!==ids[index]))throw new Error("invalid_report_sections");}
  return selected;
}
export function reportOutputBudget(options:Pick<ReportOptions,"purpose">,policy:ReportPolicy|null){
  if(options.purpose!=="competition")return {bytes:REPORT_LIMITS.bytes,pages:REPORT_LIMITS.pages,coverPages:0,contentPages:REPORT_LIMITS.pages,exclusive:false};
  const limits=policy?.constraints??{},pages=Math.min(REPORT_LIMITS.pages,Number(limits.maxPages)),coverPages=1;
  return {bytes:Math.min(REPORT_LIMITS.bytes,Number(limits.maxFileMb)*(limits.fileUnit==="MB"?1_000_000:1024*1024)),pages,coverPages,contentPages:Math.min(pages-coverPages,Number(limits.maxContentPages??pages-coverPages)),exclusive:true};
}
export function reportOutputWithinBudget(output:{bytes:number;pages:number|null},options:Pick<ReportOptions,"purpose"|"format">,policy:ReportPolicy|null){
  const limit=reportOutputBudget(options,policy);
  if(!Number.isSafeInteger(output.bytes)||output.bytes<1||!Number.isFinite(limit.bytes)||!Number.isSafeInteger(limit.pages)||limit.pages<1)return false;
  if(output.pages!==null&&(!Number.isSafeInteger(output.pages)||output.pages<1))return false;
  if(output.bytes>limit.bytes||(limit.exclusive&&output.bytes===limit.bytes))return false;
  if(options.purpose==="competition"&&(options.format!=="pdf"||output.pages===null||!Number.isSafeInteger(output.pages)||output.pages<2))return false;
  return output.pages===null||output.pages<=limit.pages&&output.pages-limit.coverPages<=limit.contentPages;
}
export type ReportWarning={code:string;recordId?:string;artifactId?:string};
export type RecordRef={localId:string;canonicalId:string;entityType:string;sourceHash:string|null;authorUserId:string|null;importedBy:string|null;originalAuthorLabel:string|null;annotationId:string|null;annotationHash:string|null;sourceOriginal:unknown;annotationHistory:Array<{id:string;authorUserId:string|null;sourceMethod:string;provenance:string;supersedesId:string|null;createdAt:string;body:string}>};
export type ReportMedia={id:string;recordId:string;mimeType:string;bytes:number;sha256:string|null;storageKey:string|null;caption:string;alt:string;modelId:string|null;versionLabel:string|null;annotationId:string|null};
export type ReportData={schemaVersion:1;exportId:string;version:number;createdAt:string;creator:{id:string;displayName:string};
  team:{id:string;name:string;program:string};season:{id:string;name:string};project:WorkspaceProject;
  projectSnapshotId:string|null;projectRevision:number;options:ReportOptions;refs:RecordRef[];media:ReportMedia[];policyGate:PolicyGate;
  warnings:ReportWarning[];completeness:{selected:number;available:number;complete:boolean};contentHash:string};
export function reportHash(value:string|Buffer){return createHash("sha256").update(value).digest("hex");}
export function decisionEvidenceIds(decisionId:string,records:WorkspaceRecord[],links:WorkspaceProject["links"]):string[]{
  // Only an included source/test is evidence. A decision causing a later
  // iteration, an unrelated decision or a suggested edge must not clear the
  // competition preflight warning. Legacy generic incoming links are retained.
  const evidenceIds=new Set(records.filter(record=>record.kind==="source"||record.kind==="test").map(record=>record.id));
  const incomingEvidence=new Set(["RELATED_TO","SUPPORTS","CONTRADICTS","REFERENCES"]);
  const outgoingEvidence=new Set(["DERIVED_FROM","RESPONDS_TO"]);
  const found=new Set<string>();
  for(const link of links){
    if(link.status!=="accepted")continue;
    if(link.to===decisionId&&evidenceIds.has(link.from)&&incomingEvidence.has(link.relationType||"RELATED_TO"))found.add(link.from);
    if(link.from===decisionId&&evidenceIds.has(link.to)&&outgoingEvidence.has(link.relationType||"RELATED_TO"))found.add(link.to);
  }
  return [...found];
}
export function recordWarnings(records:WorkspaceRecord[],project:WorkspaceProject,refs:RecordRef[]):ReportWarning[]{
  const warnings:ReportWarning[]=[];
  for(const record of records){
    if((record.kind==="decision"||record.kind==="iteration"&&record.status==="closed")&&!record.rationale?.trim())warnings.push({code:"missing_why",recordId:record.id});
    if(record.kind==="decision"&&!decisionEvidenceIds(record.id,records,project.links).length)warnings.push({code:"missing_evidence",recordId:record.id});
    if(/[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\d ()-]{8,}\d)/i.test([record.title,record.body,record.rationale,record.author].join(" ")))warnings.push({code:"possible_personal_data",recordId:record.id});
    if(!refs.find(ref=>ref.localId===record.id)?.authorUserId)warnings.push({code:"unverified_import_author",recordId:record.id});
  }
  if(project.educationalOrigin||project.dataKind==="synthetic")warnings.push({code:"educational_origin"});
  warnings.push({code:"human_privacy_review_required"});
  return warnings;
}
export function publicManifest(data:ReportData){
  return {schemaVersion:1,exportId:data.exportId,version:data.version,createdAt:data.createdAt,creator:data.creator,
    projectId:data.project.id,projectSnapshotId:data.projectSnapshotId,projectRevision:data.projectRevision,
    educationalOrigin:Boolean(data.project.educationalOrigin),scope:data.options.scope,format:data.options.format,
    locale:data.options.locale,paper:data.options.paper,contentHash:data.contentHash,
    layout:{purpose:data.options.purpose,sections:data.options.sections??null,teamNumber:data.options.teamNumber??null},
    generation:{method:"deterministic-layout",aiUsed:false,studentTextRewritten:false},policy:data.policyGate,
    records:data.refs,media:data.media.map(({storageKey: _key,...media})=>media),warnings:data.warnings,completeness:data.completeness};
}
export const reportCopy={
  en:{title:"Engineering evidence",intro:"A deterministic record of the selected materials. Student text is preserved. This report does not certify compliance with competition rules or predict an award.",educational:"EDUCATIONAL DATA — not real research observations",contents:"Selected materials",source:"Source",iteration:"Iteration",test:"Test",decision:"Decision",author:"Author",date:"Recorded",why:"Student-stated rationale",result:"Result",conditions:"Conditions",criterion:"Criterion",revision:"Revision",links:"Evidence links",provenance:"Source and version register",policy:"Competition policy",unreviewed:"No current reviewed competition policy. Engineering report only.",review:"Review personal data and permissions before sharing. Automated checks cannot identify every sensitive detail.",missing:"Not documented",media:"Related files",mediaMissing:"File not embedded; see the exact reference in the manifest.",manifest:"The complete provenance manifest is attached as iznera-manifest.json.",page:"Page",scope:"Scope",version:"Version",hash:"Content SHA-256",study:"Research observations",unit:"Unit",trials:"Trials",successes:"Successes",unverified:"Imported author label; identity not verified",warnings:"Preflight warnings"},
  ru:{title:"Инженерные доказательства",intro:"Детерминированный отчёт по выбранным материалам. Авторский текст сохранён. Отчёт не подтверждает соответствие правилам соревнования и не гарантирует награду.",educational:"УЧЕБНЫЕ ДАННЫЕ — не реальные исследовательские наблюдения",contents:"Выбранные материалы",source:"Источник",iteration:"Итерация",test:"Испытание",decision:"Решение",author:"Автор",date:"Записано",why:"Обоснование автора",result:"Результат",conditions:"Условия",criterion:"Критерий",revision:"Версия",links:"Связи с доказательствами",provenance:"Реестр источников и версий",policy:"Правила соревнования",unreviewed:"Нет актуальной проверенной версии правил. Только инженерный отчёт.",review:"Перед передачей проверьте персональные данные и разрешения. Автоматическая проверка не обнаруживает все чувствительные сведения.",missing:"Не задокументировано",media:"Связанные файлы",mediaMissing:"Файл не встроен; точная ссылка сохранена в манифесте.",manifest:"Полный манифест происхождения вложен как iznera-manifest.json.",page:"Страница",scope:"Область",version:"Версия",hash:"SHA-256 содержимого",study:"Исследовательские наблюдения",unit:"Единица",trials:"Попытки",successes:"Успешные",unverified:"Импортированная подпись автора; личность не проверена",warnings:"Предупреждения проверки"},
  kk:{title:"Инженерлік дәлелдер",intro:"Таңдалған материалдардың детерминді есебі. Автор мәтіні сақталған. Есеп жарыс ережелеріне сәйкестікті растамайды және марапатқа кепілдік бермейді.",educational:"ОҚУ ДЕРЕКТЕРІ — нақты зерттеу бақылаулары емес",contents:"Таңдалған материалдар",source:"Дереккөз",iteration:"Итерация",test:"Сынақ",decision:"Шешім",author:"Автор",date:"Жазылған",why:"Автордың негіздемесі",result:"Нәтиже",conditions:"Жағдайлар",criterion:"Критерий",revision:"Нұсқа",links:"Дәлелдермен байланыстар",provenance:"Дереккөздер мен нұсқалар тізілімі",policy:"Жарыс ережелері",unreviewed:"Ережелердің өзекті тексерілген нұсқасы жоқ. Тек инженерлік есеп.",review:"Бөліспес бұрын жеке деректер мен рұқсаттарды тексеріңіз. Автоматты тексеру барлық құпия мәліметті анықтамайды.",missing:"Құжатталмаған",media:"Байланысты файлдар",mediaMissing:"Файл енгізілмеген; нақты сілтемесі манифестте сақталған.",manifest:"Толық шығу тегі манифесті iznera-manifest.json ретінде тіркелген.",page:"Бет",scope:"Ауқым",version:"Нұсқа",hash:"Мазмұнның SHA-256 мәні",study:"Зерттеу бақылаулары",unit:"Өлшем бірлігі",trials:"Талпыныстар",successes:"Сәттілері",unverified:"Импортталған автор белгісі; тұлғасы тексерілмеген",warnings:"Алдын ала тексеру ескертулері"},
} as const;

export function reportWarningText(code:string,locale:ReportOptions["locale"]){
  const messages:Record<string,Record<ReportOptions["locale"],string>>={
    missing_why:{en:"The student's rationale is missing.",ru:"Не записано обоснование автора.",kk:"Автордың негіздемесі жазылмаған."},
    missing_evidence:{en:"The decision has no linked evidence.",ru:"У решения нет связанных доказательств.",kk:"Шешімге дәлелдер байланыстырылмаған."},
    possible_personal_data:{en:"Possible personal data: review before sharing.",ru:"Возможны персональные данные: проверьте перед передачей.",kk:"Жеке деректер болуы мүмкін: бөліспес бұрын тексеріңіз."},
    unverified_import_author:{en:"Imported author label; identity has not been verified.",ru:"Импортированная подпись автора; личность не проверена.",kk:"Импортталған автор белгісі; тұлғасы тексерілмеген."},
    educational_origin:{en:"Educational data must not be presented as real research.",ru:"Учебные данные нельзя представлять как результаты реального исследования.",kk:"Оқу деректерін нақты зерттеу нәтижелері ретінде көрсетуге болмайды."},
    human_privacy_review_required:{en:"A person must review privacy and permission to share.",ru:"Нужна проверка персональных данных и разрешения на передачу человеком.",kk:"Жеке деректер мен бөлісу рұқсатын адам тексеруі керек."},
    engineering_not_competition_approval:{en:"Engineering report only; competition compliance has not been certified.",ru:"Только инженерный отчёт; соответствие правилам соревнования не подтверждено.",kk:"Тек инженерлік есеп; жарыс ережелеріне сәйкестік расталмаған."},
    media_reference_only:{en:"The file is listed in the manifest; its binary contents are not embedded.",ru:"Файл указан в манифесте; его содержимое не встроено.",kk:"Файл манифестте көрсетілген; мазмұны енгізілмеген."},
    image_not_embedded:{en:"The image exceeds the documented report limit or has no stored file.",ru:"Изображение превышает указанный лимит отчёта или файл отсутствует.",kk:"Сурет есеп шегінен асады немесе сақталған файл жоқ."},
    missing_or_changed_asset:{en:"An attached file is missing or its hash does not match.",ru:"Вложенный файл отсутствует или его контрольная сумма не совпадает.",kk:"Тіркелген файл жоқ немесе бақылау сомасы сәйкес емес."},
    outside_policy_content_window:{en:"The record is outside the policy's permitted evidence period.",ru:"Запись выходит за допустимый период материалов по правилам.",kk:"Жазба ережеде рұқсат етілген материал кезеңінен тыс."},
  };
  return messages[code]?.[locale]??code;
}
export function reportScopeText(scope:ReportOptions["scope"],locale:ReportOptions["locale"]){
  return {project:{ru:"Выбранные материалы проекта",en:"Selected project evidence",kk:"Таңдалған жоба материалдары"},personal:{ru:"Мои авторские записи",en:"My authored records",kk:"Менің авторлық жазбаларым"},handoff:{ru:"Передача проекта",en:"Project handoff",kk:"Жобаны тапсыру"}}[scope][locale];
}

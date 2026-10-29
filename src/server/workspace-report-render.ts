import PDFDocument from "pdfkit";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { publicManifest, reportCopy, reportWarningText, reportScopeText, REPORT_LIMITS, type ReportData } from "./workspace-report-model";

export type ReportImage={id:string;bytes:Buffer;mimeType:"image/png"|"image/jpeg"};
const escape=(value:unknown)=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]!));
const fontPath=()=>path.join(process.cwd(),"assets","report-fonts","NotoSans.ttf");
const logoPath=()=>path.join(process.cwd(),"public","brand","iznera-logo.png");
function recordFields(data:ReportData,index:number){
  const record=data.project.records[index],copy=reportCopy[data.options.locale];
  return [[copy.why,record.kind==="decision"?(record.rationale||copy.missing):null],
    [copy.result,record.measuredValue],[copy.unit,record.unit],[copy.trials,record.trials],[copy.successes,record.successes],
    [copy.conditions,record.conditions],[copy.criterion,record.criterion],[copy.revision,record.revision]]
    .filter(([,value])=>value!==null&&value!==undefined&&value!=="");
}
function policyText(data:ReportData){
  const p=data.policyGate.policy,copy=reportCopy[data.options.locale];
  return !p?copy.unreviewed:[p.program,p.season,p.version,p.status,p.reviewedAt,p.reviewer,...p.sourceUrls].filter(Boolean).join(" · ");
}
export async function renderReportHtml(data:ReportData,images:ReportImage[]=[]){
  const c=reportCopy[data.options.locale],manifest=publicManifest(data);
  const [fontBytes,logoBytes]=await Promise.all([readFile(fontPath()),readFile(logoPath())]);
  const font=fontBytes.toString("base64"),logo=logoBytes.toString("base64");
  const records=data.project.records.map((r,index)=>`<article><p class="meta">${escape(c[r.kind])} · ${escape(r.id)}</p><h2>${escape(r.title)}</h2>
    <p class="meta">${escape(c.author)}: ${escape(r.author)} · ${escape(c.date)}: ${escape(r.createdAt)}</p>
    <p class="text">${escape(r.body)}</p>${recordFields(data,index).map(([label,value])=>`<h3>${escape(label)}</h3><p class="text">${escape(value)}</p>`).join("")}
    ${data.media.filter(m=>m.recordId===r.id).map(media=>{const image=images.find(item=>item.id===media.id);return `<figure>${image?`<img alt="${escape(media.alt||media.caption)}" src="data:${image.mimeType};base64,${image.bytes.toString("base64")}">`:`<p>${escape(c.mediaMissing)}</p>`}<figcaption>${escape(media.caption)} · ${escape(media.id)}${media.modelId?` · ${escape(media.modelId)} · ${escape(media.versionLabel)}`:""}</figcaption></figure>`;}).join("")}
    <p class="meta">${escape(c.links)}: ${escape(data.project.links.filter(link=>link.from===r.id||link.to===r.id).map(link=>`${link.from} -> ${link.to} (${link.label})`).join("; ")||c.missing)}</p></article>`).join("");
  return `<!doctype html><html lang="${data.options.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"><title>${escape(data.project.name)} — Iznera</title><style>
  @font-face{font-family:Noto;src:url(data:font/ttf;base64,${font}) format('truetype')}*{box-sizing:border-box}body{font-family:Noto,sans-serif;color:#212726;background:#fff;margin:0 auto;padding:48px 28px;max-width:900px;line-height:1.65}header{border-bottom:2px solid #263d37;padding-bottom:24px}h1{font-size:32px;line-height:1.25}h2{font-size:23px}h3{font-size:14px;margin-bottom:4px}.meta,figcaption{font-size:11px;color:#4e5e58;overflow-wrap:anywhere}article{padding:24px 0;border-bottom:1px solid #ccd4cd}.text{white-space:pre-wrap;overflow-wrap:anywhere}figure{margin:20px 0}img{max-width:100%;max-height:420px;object-fit:contain}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:9px Noto;line-height:1.5}.notice{padding:14px;background:#f0f2e9;border-left:3px solid #60774b}@page{size:${data.options.paper==="A4"?"A4":"letter"};margin:20mm}@media print{body{padding:0;max-width:none}h2,h3,figcaption{break-after:avoid}figure{break-inside:avoid}a{color:inherit}} </style></head><body>
  <header><img alt="Iznera" src="data:image/png;base64,${logo}" width="144" height="48"><p>Iznera · ${escape(c.title)}</p><h1>${escape(data.project.name)}</h1><p>${escape(data.team.name)} · ${escape(data.season.name)}</p><p class="meta">${escape(c.version)} ${data.version} · ${escape(data.createdAt)} · ${escape(c.scope)}: ${escape(reportScopeText(data.options.scope,data.options.locale))}</p></header>
  <p>${escape(c.intro)}</p>${data.project.educationalOrigin?`<p class="notice">${escape(c.educational)}</p>`:""}<p class="notice">${escape(c.review)}</p>
  <h2>${escape(c.policy)}</h2><p>${escape(policyText(data))}</p><h2>${escape(c.contents)} (${data.completeness.selected}/${data.completeness.available})</h2>${records}
  <h2>${escape(c.study)}</h2><pre>${escape(JSON.stringify(data.project.studyRows,null,2))}</pre><h2>${escape(c.provenance)}</h2><pre>${escape(JSON.stringify(manifest,null,2))}</pre></body></html>`;
}

export async function renderReportPdf(data:ReportData,images:ReportImage[]=[]):Promise<{bytes:Buffer;pages:number}>{
  const copy=reportCopy[data.options.locale];
  const logo=await readFile(logoPath());
  const doc=new PDFDocument({size:data.options.paper,bufferPages:true,margins:{top:48,left:48,right:48,bottom:64},
    info:{Title:data.project.name,Author:data.creator.displayName,Subject:copy.title,Creator:"Iznera deterministic report",CreationDate:new Date(data.createdAt),ModDate:new Date(data.createdAt)}});
  const chunks:Buffer[]=[];let size=0;let failure:Error|undefined;
  const complete=new Promise<Buffer>((resolve,reject)=>{doc.on("data",(chunk:Buffer)=>{size+=chunk.length;if(size>REPORT_LIMITS.bytes){failure=new Error("report_size_limit");doc.destroy(failure);}else chunks.push(chunk);});doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);});
  // Attach rejection handling immediately; synchronous layout can fail before end().
  void complete.catch(()=>{});
  doc.registerFont("Noto",fontPath()).font("Noto");
  let pages=1;
  doc.on("pageAdded",()=>{pages++;if(pages>REPORT_LIMITS.pages)throw new Error("report_page_limit");doc.font("Noto").fillColor("#212726");});
  const width=()=>doc.page.width-96;
  const room=(height:number)=>{if(doc.y+height>doc.page.height-68)doc.addPage();};
  const paragraph=(text:unknown,size=10.5,color="#28352f")=>{doc.font("Noto").fontSize(size).fillColor(color).text(String(text??""),48,doc.y,{width:width(),lineGap:3});doc.moveDown(.6);};
  const heading=(text:string)=>{room(85);paragraph(text,17,"#243b32");};
  try{
    doc.image(logo,48,doc.y,{fit:[120,40]});doc.y+=52;
    paragraph("Iznera / "+copy.title,11,"#536b5f");paragraph(data.project.name,27);paragraph(`${data.team.name} · ${data.season.name}`,12);
    paragraph(`${copy.version} ${data.version} · ${data.createdAt} · ${copy.scope}: ${reportScopeText(data.options.scope,data.options.locale)}`,9);
    paragraph(copy.intro);if(data.project.educationalOrigin)paragraph(copy.educational,11,"#805315");paragraph(copy.review,9);
    heading(copy.policy);paragraph(policyText(data),9);
    heading(`${copy.contents} (${data.completeness.selected}/${data.completeness.available})`);
    for(const [index,record] of data.project.records.entries()){
      room(115);paragraph(`${copy[record.kind]} · ${record.id}`,9,"#536b5f");paragraph(record.title,17);
      paragraph(`${copy.author}: ${record.author} · ${copy.date}: ${record.createdAt}`,9);
      const ref=data.refs.find(item=>item.localId===record.id);if(!ref?.authorUserId)paragraph(copy.unverified,8,"#805315");
      paragraph(record.body||copy.missing);
      for(const [label,value] of recordFields(data,index)){room(55);paragraph(label,10,"#536b5f");paragraph(value);}
      const links=data.project.links.filter(link=>link.from===record.id||link.to===record.id);
      if(links.length)paragraph(copy.links+": "+links.map(link=>`${link.from} -> ${link.to} (${link.label})`).join("; "),9);
      for(const media of data.media.filter(item=>item.recordId===record.id)){
        const image=images.find(item=>item.id===media.id);
        if(image){room(290);const top=doc.y;doc.image(image.bytes,48,top,{fit:[width(),230]});doc.y=top+240;}
        else paragraph(copy.mediaMissing,9);
        paragraph(`${media.caption} · ${media.id}${media.modelId?` · ${media.modelId} · ${media.versionLabel}`:""}`,8);
      }
      doc.moveDown();
    }
    if(data.project.studyRows.length){heading(copy.study);for(const row of data.project.studyRows)paragraph(JSON.stringify(row),9);}
    const spacedHash=(value:string|null)=>(value??"—").match(/.{1,16}/g)?.join(" ")??"—";
    heading(copy.provenance);paragraph(copy.manifest,9);paragraph(`${copy.hash}:\n${spacedHash(data.contentHash)}`,8);
    for(const ref of data.refs){room(80);paragraph(`${ref.localId} -> ${ref.entityType}: ${ref.canonicalId}\nSource SHA-256: ${spacedHash(ref.sourceHash)}\nAnnotation: ${ref.annotationId??"—"}\nSHA-256: ${spacedHash(ref.annotationHash)}`,8);}
    heading(copy.warnings);for(const warning of data.warnings)paragraph([reportWarningText(warning.code,data.options.locale),warning.recordId,warning.artifactId].filter(Boolean).join(" · "),8);
    doc.file(Buffer.from(JSON.stringify(publicManifest(data),null,2)),{name:"iznera-manifest.json",type:"application/json",description:copy.provenance,creationDate:new Date(data.createdAt),modifiedDate:new Date(data.createdAt)});
    const range=doc.bufferedPageRange();pages=range.count;
    for(let i=range.start;i<range.start+range.count;i++){
      doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;
      doc.font("Noto").fontSize(8).fillColor("#52635a").text(`Iznera · ${copy.page} ${i+1} / ${range.count}`,48,doc.page.height-39,{width:width(),lineBreak:false});
      doc.page.margins.bottom=bottom;
    }
    doc.end();const bytes=await complete;if(failure)throw failure;return {bytes,pages};
  }catch(error){doc.destroy();throw error;}
}

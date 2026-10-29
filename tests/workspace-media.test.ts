import { describe,expect,it } from "vitest";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { inspectGlb, MEDIA_LIMITS, parseUploadMetadata, readUploadBytes, uploadFingerprint, uploadMetadata } from "../src/server/workspace-media-contract";
import { prepareMedia } from "../src/server/workspace-media-files";
import { PrivateSupabaseStorage } from "../src/server/workspace-media-storage";

function metadata(kind:"photo"|"document"|"model"="photo"){
  return uploadMetadata.parse({teamId:randomUUID(),projectId:randomUUID(),requestId:randomUUID(),kind,name:"Original student name",filename:kind==="model"?"part.glb":"photo.png",occurredAt:"2026-10-26T12:00:00Z",...(kind==="model"?{model:{category:"part",versionLabel:"v1"}}:{})});
}
function glb(change?:(doc:Record<string,any>,bin:Buffer)=>void){
  const bin=Buffer.alloc(36);[0,0,0,1,0,0,0,1,0].forEach((v,i)=>bin.writeFloatLE(v,i*4));
  const doc={asset:{version:"2.0"},buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],
    accessors:[{bufferView:0,componentType:5126,count:3,type:"VEC3",min:[0,0,0],max:[1,1,0]}],
    meshes:[{primitives:[{attributes:{POSITION:0}}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};
  change?.(doc,bin);const json=Buffer.from(JSON.stringify(doc)),padded=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(padded);
  const header=Buffer.alloc(20);header.write("glTF");header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+bin.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const chunk=Buffer.alloc(8);chunk.writeUInt32LE(bin.length);chunk.writeUInt32LE(0x004e4942,4);
  return Buffer.concat([header,padded,chunk,bin]);
}
describe("bounded source upload contract",()=>{
  it("round trips multilingual metadata without treating a filename as a path",()=>{
    const input={...metadata(),name:"Құрастыру · Проверка",filename:"../../private.png"};
    expect(parseUploadMetadata(encodeURIComponent(JSON.stringify(input))).name).toBe(input.name);
    expect(()=>parseUploadMetadata("%invalid")).toThrow();
    expect(()=>parseUploadMetadata(encodeURIComponent(JSON.stringify({...input,storageKey:"other/file"})))).toThrow();
  });
  it("fingerprints bytes and complete typed metadata; repeated request cannot change captions",()=>{
    const input=metadata(),bytes=Buffer.from("test");
    expect(uploadFingerprint(input,bytes)).toBe(uploadFingerprint({...input},bytes));
    expect(uploadFingerprint({...input,caption:"changed"},bytes)).not.toBe(uploadFingerprint(input,bytes));
    expect(uploadFingerprint(input,Buffer.from("other"))).not.toBe(uploadFingerprint(input,bytes));
  });
  it("counts streamed bytes even when content-length lies or is absent",async()=>{
    const request=new Request("http://localhost",{method:"POST",body:new Uint8Array(12),headers:{"content-length":"2"}});
    await expect(readUploadBytes(request,8)).rejects.toMatchObject({code:"file_too_large"});
    await expect(readUploadBytes(new Request("http://localhost",{method:"POST",body:new Uint8Array(12)}),8)).rejects.toMatchObject({status:413});
    await expect(readUploadBytes(new Request("http://localhost",{method:"POST",body:"abc",headers:{"content-length":"8"}}),8)).rejects.toMatchObject({code:"incomplete_file"});
  });
});
describe("private image/document pipeline",()=>{
  it("applies orientation before stripping metadata and hashes the stored bytes",async()=>{
    const original=await sharp({create:{width:12,height:20,channels:3,background:"#e6dcff"}}).jpeg().withMetadata({orientation:6}).toBuffer();
    expect((await sharp(original).metadata()).exif).toBeTruthy();
    const result=await prepareMedia(metadata(),original),image=await sharp(result.bytes).metadata();
    expect(image.width).toBe(20);expect(image.height).toBe(12);expect(image.exif).toBeUndefined();expect(image.orientation).toBeUndefined();
    expect(result.mimeType).toBe("image/png");expect(result.thumbnail).toBeTruthy();expect(result.metadata.originalBytesRetained).toBe(false);
    expect((await sharp(result.thumbnail!).metadata()).format).toBe("webp");
  });
  it("rejects fake, truncated and overly large decoded images",async()=>{
    await expect(prepareMedia(metadata(),Buffer.from("<svg onload=alert(1)>"))).rejects.toMatchObject({code:"unsupported_file"});
    await expect(prepareMedia(metadata(),Buffer.from([255,216,255,0,0]))).rejects.toMatchObject({code:"invalid_image"});
    const wide=await sharp({create:{width:8200,height:1,channels:3,background:"black"}}).png().toBuffer();
    await expect(prepareMedia(metadata(),wide)).rejects.toMatchObject({code:"image_budget_exceeded"});
  });
  it("preserves PDF/UTF-8 CSV source bytes and only offers downloads",async()=>{
    const pdf=Buffer.from("%PDF-1.7\n0 0 obj\n%%EOF"),csv=Buffer.from("condition,result\nA,17\n");
    expect((await prepareMedia(metadata("document"),pdf)).bytes).toEqual(pdf);
    const result=await prepareMedia({...metadata("document"),filename:"measurements.csv"},csv);
    expect(result.bytes).toEqual(csv);expect(result.metadata.preview).toBe("download-only");
    await expect(prepareMedia({...metadata("document"),filename:"x.csv"},Buffer.from([0xff,0xfe]))).rejects.toMatchObject({code:"invalid_csv"});
    await expect(prepareMedia(metadata("document"),Buffer.from("%PDF-1.7 incomplete"))).rejects.toThrow();
  });
});
describe("self-contained GLB validation",()=>{
  it("accepts a real self-contained triangle without changing its bytes",async()=>{
    const bytes=glb(),result=inspectGlb(bytes);expect(result.vertices).toBe(3);expect(result.triangles).toBe(1);
    expect((await prepareMedia(metadata("model"),bytes)).bytes).toEqual(bytes);
  });
  it.each(["https://attacker.invalid/a.bin","../../private.bin","data:application/octet-stream;base64,AAAA"])("rejects any external/data resource URI %s",uri=>{
    expect(()=>inspectGlb(glb(doc=>doc.buffers[0].uri=uri))).toThrow("model_external_resource");
  });
  it("rejects truncated files, invalid ranges and huge declared geometry",()=>{
    expect(()=>inspectGlb(glb().subarray(0,-4))).toThrow();
    expect(()=>inspectGlb(glb(doc=>doc.bufferViews[0].byteLength=500))).toThrow();
    expect(()=>inspectGlb(glb(doc=>doc.accessors[0].count=MEDIA_LIMITS.vertices*4))).toThrow();
  });
  it("rejects NaN positions, cyclic graph and repeated parents",()=>{
    expect(()=>inspectGlb(glb((_doc,bin)=>bin.writeFloatLE(NaN,0)))).toThrow();
    expect(()=>inspectGlb(glb(doc=>doc.nodes[0].children=[0]))).toThrow();
    expect(()=>inspectGlb(glb(doc=>doc.nodes.push({children:[0,0]})))).toThrow();
  });
  it("rejects unsupported compressed/sparse/animated geometry rather than bypassing budgets",()=>{
    expect(()=>inspectGlb(glb(doc=>doc.extensionsUsed=["KHR_draco_mesh_compression"]))).toThrow("model_unsupported_feature");
    expect(()=>inspectGlb(glb(doc=>doc.accessors[0].sparse={}))).toThrow("model_unsupported_feature");
    expect(()=>inspectGlb(glb(doc=>doc.animations=[{}]))).toThrow("model_unsupported_feature");
  });
});
describe("optional Supabase private adapter contract (mock transport, not a live provider)",()=>{
  it("refuses a public bucket before uploading and rejects traversal before network",async()=>{
    const calls:string[]=[];
    const fake=async(input:RequestInfo|URL)=>{calls.push(String(input));return Response.json({public:true});};
    const store=new PrivateSupabaseStorage("https://project.supabase.co","test-only-key","private",fake as typeof fetch);
    await expect(store.put("team/uploads/source.png",Buffer.from("x"),"image/png")).rejects.toMatchObject({code:"private_bucket_required"});
    expect(calls).toHaveLength(1);
    await expect(store.get("team/../private")).rejects.toMatchObject({code:"invalid_storage_key"});expect(calls).toHaveLength(1);
  });
  it("uses authenticated GET and immutable POST, never public URLs or upsert",async()=>{
    const calls:Array<{url:string;options?:RequestInit}>=[];
    const fake=async(input:RequestInfo|URL,options?:RequestInit)=>{const url=String(input);calls.push({url,options});
      return url.includes("/bucket/")?Response.json({public:false}):new Response("content");};
    const store=new PrivateSupabaseStorage("https://project.supabase.co","test-only-key","private",fake as typeof fetch);
    await store.put("team/uploads/source.glb",Buffer.from("bytes"),"model/gltf-binary");
    expect(calls[1].options?.method).toBe("POST");expect(calls[1].options?.headers).toMatchObject({"x-upsert":"false"});
    expect((await store.get("team/uploads/source.glb"))?.toString()).toBe("content");
    expect(calls[3].url).toContain("/object/authenticated/private/");expect(calls.every(call=>!call.url.includes("/public/"))).toBe(true);
  });
});

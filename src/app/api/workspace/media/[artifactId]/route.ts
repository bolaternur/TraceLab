import { getCurrentUser } from "@/server/auth";
import { accountOrigin, readAccountJson } from "@/server/account-contract";
import { readWorkspaceMedia, updateWorkspaceMedia } from "@/server/workspace-media-service";
import { mediaFailure, mediaHeaders, mediaJson } from "@/server/workspace-media-http";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{artifactId:string}>};
export async function GET(request:Request,context:Context){
  try{
    const user=await getCurrentUser();if(!user)return mediaJson({error:{code:"unauthenticated"}},401);
    const {artifactId}=await context.params;
    const media=await readWorkspaceMedia(user,artifactId,new URL(request.url).searchParams.get("variant")==="thumbnail");
    const attachment=!media.mimeType.startsWith("image/") && media.mimeType!=="model/gltf-binary";
    const extension=media.mimeType==="application/pdf"?"pdf":media.mimeType==="text/csv"?"csv":media.mimeType==="model/gltf-binary"?"glb":media.mimeType==="image/webp"?"webp":"png";
    return new Response(new Uint8Array(media.bytes),{headers:{...mediaHeaders,"Content-Type":media.mimeType,"Content-Length":String(media.bytes.length),
      "Content-Disposition":`${attachment?"attachment":"inline"}; filename="iznera-${artifactId}.${extension}"`,
      "Content-Security-Policy":"default-src 'none'; sandbox"}});
  }catch(error){return mediaFailure(error);}
}
export async function PATCH(request:Request,context:Context){
  try{
    accountOrigin(request.url,request.headers);
    const user=await getCurrentUser();if(!user)return mediaJson({error:{code:"unauthenticated"}},401);
    const {artifactId}=await context.params;
    return mediaJson(await updateWorkspaceMedia(user,artifactId,await readAccountJson(request,32_768)));
  }catch(error){return mediaFailure(error);}
}

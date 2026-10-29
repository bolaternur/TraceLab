import {chatFile,chatDiscard} from '@/server/workspace-chat-http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,context:{params:Promise<{attachmentId:string}>}){return chatFile(request,(await context.params).attachmentId);}
export async function DELETE(request:Request,context:{params:Promise<{attachmentId:string}>}){return chatDiscard(request,(await context.params).attachmentId);}

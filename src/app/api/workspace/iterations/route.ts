import {getCurrentUser} from "@/server/auth";
import {workspaceTransaction,WorkspaceError} from "@/server/workspace-service";
import {sourcesFailure,sourcesJson} from "@/server/workspace-sources-http";
import {z} from "zod";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Suggestions use existing project taxonomy, with the same private membership check. */
export async function GET(request:Request) {
  try {
    const user=await getCurrentUser();
    if(!user)return sourcesJson({error:{code:"unauthenticated"}},401);
    const projectId=z.string().uuid().parse(new URL(request.url).searchParams.get("project"));
    return sourcesJson(await workspaceTransaction(user,async client=>{
      const access=await client.query("SELECT 1 FROM projects p JOIN team_memberships m ON m.team_id=p.team_id AND m.user_id=$2 AND m.status='active' WHERE p.id=$1",[projectId,user.id]);
      if(!access.rowCount)throw new WorkspaceError("forbidden",403,"Нет доступа к проекту.");
      const subsystems=(await client.query<{name:string}>("SELECT name FROM subsystems WHERE project_id=$1 ORDER BY name,id LIMIT 500",[projectId])).rows;
      return {subsystems:subsystems.map(item=>item.name)};
    }));
  }catch(error){return sourcesFailure(error);}
}

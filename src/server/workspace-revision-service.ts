import {z} from "zod";
import {workspaceTransaction, WorkspaceError, type WorkspaceUser} from "./workspace-service";

/** Small, private revision feed. Every poll rechecks verified membership; it
 * returns no records, invite codes, file locations or other teams' metadata. */
export async function getWorkspaceRevision(user: WorkspaceUser, teamId: string) {
  const id=z.string().uuid().parse(teamId);
  return workspaceTransaction(user,async client=>{
    const team=(await client.query<{id:string;name:string;timezone:string;role:string}>(
      `SELECT t.id,t.name,t.timezone,m.role FROM teams t JOIN team_memberships m ON m.team_id=t.id
       WHERE t.id=$1 AND m.user_id=$2 AND m.status='active'`,[id,user.id])).rows[0];
    if(!team)throw new WorkspaceError("forbidden",403,"Нет доступа к команде.");
    const projects=(await client.query<{id:string;serverRevision:number}>(
      `SELECT p.id,COALESCE(s.revision,0)::integer AS "serverRevision" FROM projects p
       LEFT JOIN workspace_project_state s ON s.project_id=p.id AND s.team_id=p.team_id
       WHERE p.team_id=$1 ORDER BY p.created_at,p.id`,[id])).rows;
    return {team:{id:team.id,name:team.name,timezone:team.timezone},role:team.role,projects};
  });
}

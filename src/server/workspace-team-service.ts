import type {PoolClient} from "pg";
import {z} from "zod";
import {workspaceTransaction,type WorkspaceUser} from "./workspace-service";

export class TeamError extends Error {constructor(public code:string,public status=422){super(code);this.name="TeamError";}}
const uuid=z.string().uuid(),role=z.enum(["student","student_lead","coach"]),status=z.enum(["active","removed","alumni"]);
export const teamCommand=z.discriminatedUnion("command",[
  z.object({command:z.literal("changeMember"),teamId:uuid,userId:uuid,role:z.enum(["student","student_lead"]),status:z.enum(["active","removed"]),expectedRole:role,expectedStatus:status}).strict(),
  z.object({command:z.literal("settings"),teamId:uuid,name:z.string().trim().min(1).max(120),timezone:z.string().min(1).max(80),locale:z.enum(["ru","en","kk"]),expectedVersion:z.number().int().nonnegative()}).strict(),
  z.object({command:z.literal("revokeInvite"),teamId:uuid,inviteId:uuid}).strict(),
]);
async function access(client:PoolClient,user:WorkspaceUser,teamId:string,write=false){
  const member=(await client.query<{role:string}>("SELECT role FROM team_memberships WHERE team_id=$1 AND user_id=$2 AND status='active'",[uuid.parse(teamId),user.id])).rows[0];
  if(!member || (write&&member.role!=="student_lead"))throw new TeamError("forbidden",403);return member;
}
export async function getWorkspaceTeam(user:WorkspaceUser,teamId:string){
  return workspaceTransaction(user,async client=>{
    const membership=await access(client,user,teamId);
    const team=(await client.query("SELECT id,name,program,timezone,default_locale AS locale,workspace_settings_version AS version FROM teams WHERE id=$1",[teamId])).rows[0];
    const members=(await client.query(`SELECT m.user_id AS "userId",u.display_name AS "displayName",m.role,m.status,m.joined_at AS "joinedAt",m.left_at AS "leftAt",
      m.user_id=$2 AS "isSelf" FROM team_memberships m JOIN users u ON u.id=m.user_id WHERE m.team_id=$1 ORDER BY m.joined_at,m.id LIMIT 200`,[teamId,user.id])).rows;
    const memberTotal=Number((await client.query<{count:string}>("SELECT count(*) FROM team_memberships WHERE team_id=$1",[teamId])).rows[0].count);
    const invites=membership.role==="student_lead"?(await client.query(`SELECT id,kind,role,email,uses,max_uses AS "maxUses",expires_at AS "expiresAt",revoked_at AS "revokedAt",created_at AS "createdAt"
      FROM team_invites WHERE team_id=$1 ORDER BY created_at DESC LIMIT 50`,[teamId])).rows:[];
    return {team,role:membership.role,members,memberTotal,invites,inviteHistoryLimit:50};
  });
}
export async function manageWorkspaceTeam(user:WorkspaceUser,raw:unknown){
  const data=teamCommand.parse(raw);
  try{return await workspaceTransaction(user,async client=>{
    await access(client,user,data.teamId,true);
    if(data.command==="changeMember"){
      await client.query("SELECT public.workspace_manage_member($1,$2,$3,$4,$5,$6)",[data.teamId,data.userId,data.role,data.status,data.expectedRole,data.expectedStatus]);
      return {ok:true,selfAccessRemoved:data.userId===user.id&&data.status==="removed"};
    }
    if(data.command==="settings"){
      await client.query("SELECT public.workspace_update_team($1,$2,$3,$4,$5)",[data.teamId,data.name,data.timezone,data.locale,data.expectedVersion]);
      return {ok:true};
    }
    const invite=(await client.query<{revoked_at:Date|null}>("SELECT revoked_at FROM team_invites WHERE id=$1 AND team_id=$2 FOR UPDATE",[data.inviteId,data.teamId])).rows[0];
    if(!invite)throw new TeamError("invite_unavailable",404);
    if(!invite.revoked_at){
      await client.query("UPDATE team_invites SET revoked_at=now() WHERE id=$1 AND team_id=$2",[data.inviteId,data.teamId]);
      await client.query("INSERT INTO audit_events(team_id,actor_user_id,action,entity_type,entity_id) VALUES($1,$2,'team.invite.revoked','team_invite',$3)",[data.teamId,user.id,data.inviteId]);
    }
    return {ok:true};
  });}catch(error){
    const code=error&&typeof error==="object"&&"code" in error?String(error.code):"";
    if(code==="42501")throw new TeamError("forbidden",403);
    if(code==="23514")throw new TeamError("last_lead",409);
    if(code==="40001")throw new TeamError("team_changed",409);
    if(code==="22023")throw new TeamError("invalid_fields",422);
    throw error;
  }
}

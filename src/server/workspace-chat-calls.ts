import {workspaceTransaction,type WorkspaceUser} from './workspace-service';
import {chatAccess,chatRate} from './workspace-chat-service';
import {callCommand,chatIceServers,CHAT_LIMITS,ChatError,sequence} from './workspace-chat-contract';
import {z} from 'zod';
import type {PoolClient} from 'pg';
const uuid=z.string().uuid();
type Participant={id:string;team_id:string;user_id:string;expires_at:Date};
async function active(client:PoolClient,teamId:string){return (await client.query(`SELECT p.id,p.user_id AS "userId",u.display_name AS "displayName",p.joined_at AS "joinedAt"
  FROM workspace_call_participants p JOIN users u ON u.id=p.user_id JOIN team_memberships m ON m.team_id=p.team_id AND m.user_id=p.user_id AND m.status='active'
  WHERE p.team_id=$1 AND p.expires_at>now() ORDER BY p.joined_at,p.id`,[teamId])).rows;}
async function own(client:PoolClient,user:WorkspaceUser,teamId:string,participantId:string){
  const row=(await client.query<Participant>(`SELECT * FROM workspace_call_participants WHERE id=$1 AND team_id=$2 AND user_id=$3 AND expires_at>now() FOR UPDATE`,[participantId,teamId,user.id])).rows[0];
  if(!row)throw new ChatError('call_expired',409);return row;
}
export async function manageTeamCall(user:WorkspaceUser,raw:unknown){
  const input=callCommand.parse(raw);
  return workspaceTransaction(user,async client=>{
    await chatAccess(client,user,input.teamId);
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`,['chat-call:'+input.teamId]);
    await chatRate(client,user,input.teamId,input.command==='signal'?'signal':'call',input.command==='signal'?500:60);
    await client.query(`DELETE FROM workspace_call_signals WHERE team_id=$1 AND created_at<now()-interval '2 minutes'`,[input.teamId]);
    await client.query(`DELETE FROM workspace_call_participants WHERE team_id=$1 AND expires_at<now()-interval '2 minutes'`,[input.teamId]);
    if(input.command==='leave'){
      await client.query(`UPDATE workspace_call_participants SET expires_at=now() WHERE id=$1 AND team_id=$2 AND user_id=$3`,[input.participantId,input.teamId,user.id]);return {left:true};
    }
    if(input.command==='join'){
      const members=await active(client,input.teamId),same=members.find(member=>member.userId===user.id);
      if(same&&same.id!==input.participantId)throw new ChatError('already_in_call',409);
      if(!same&&members.length>=CHAT_LIMITS.participants)throw new ChatError('call_full',409);
      const old=(await client.query<Participant>(`SELECT * FROM workspace_call_participants WHERE id=$1`,[input.participantId])).rows[0];
      if(old&&(old.user_id!==user.id||old.team_id!==input.teamId))throw new ChatError('forbidden',403);
      await client.query(`INSERT INTO workspace_call_participants(id,team_id,user_id) VALUES($1,$2,$3)
        ON CONFLICT(id) DO UPDATE SET joined_at=CASE WHEN workspace_call_participants.expires_at<=now() THEN now() ELSE workspace_call_participants.joined_at END,expires_at=now()+interval '45 seconds'`,[input.participantId,input.teamId,user.id]);
    }
    let me=await own(client,user,input.teamId,input.participantId);
    if(input.command==='signal'){
      if(input.toParticipantId===input.participantId)throw new ChatError('invalid_signal');
      const target=(await active(client,input.teamId)).find(item=>item.id===input.toParticipantId);
      if(!target)throw new ChatError('participant_unavailable',409);
      if(JSON.stringify(input.payload).length>55000)throw new ChatError('invalid_signal',413);
      if(input.type==='offer'||input.type==='answer'){
        if(input.payload.type!==input.type||typeof input.payload.sdp!=='string'||input.payload.sdp.length>50000)throw new ChatError('invalid_signal');
      }else if(typeof input.payload.candidate!=='string'||input.payload.candidate.length>4096)throw new ChatError('invalid_signal');
      const signal=(await client.query<{sequence:string}>(`INSERT INTO workspace_call_signals(team_id,from_participant_id,to_participant_id,kind,payload) VALUES($1,$2,$3,$4,$5) RETURNING sequence::text AS sequence`,[input.teamId,input.participantId,input.toParticipantId,input.type,JSON.stringify(input.payload)])).rows[0];
      return {sent:true,sequence:signal.sequence};
    }
    if(input.command==='heartbeat')me=(await client.query<Participant>(`UPDATE workspace_call_participants SET expires_at=now()+interval '45 seconds' WHERE id=$1 RETURNING *`,[input.participantId])).rows[0];
    const cursor=(await client.query<{value:string}>(`SELECT COALESCE(max(sequence),0)::text AS value FROM workspace_call_signals WHERE team_id=$1 AND to_participant_id=$2`,[input.teamId,input.participantId])).rows[0].value;
    return {participantId:input.participantId,participants:await active(client,input.teamId),iceServers:chatIceServers(user.id),signalCursor:cursor,expiresAt:me.expires_at,maxParticipants:CHAT_LIMITS.participants};
  });
}
export async function pollTeamCall(user:WorkspaceUser,teamId:string,participantId:string,after:string|null){
  uuid.parse(teamId);uuid.parse(participantId);const cursor=sequence(after)||'0';
  return workspaceTransaction(user,async client=>{
    await chatAccess(client,user,teamId);const me=await own(client,user,teamId,participantId);
    const signals=(await client.query(`SELECT s.sequence::text AS sequence,s.from_participant_id AS "fromParticipantId",s.kind AS type,s.payload
      FROM workspace_call_signals s JOIN workspace_call_participants p ON p.id=s.from_participant_id AND p.team_id=s.team_id
      JOIN team_memberships m ON m.team_id=p.team_id AND m.user_id=p.user_id AND m.status='active'
      WHERE s.team_id=$1 AND s.to_participant_id=$2 AND s.sequence>$3 AND s.created_at>now()-interval '2 minutes' AND p.expires_at>now()
      ORDER BY s.sequence LIMIT 100`,[teamId,participantId,cursor])).rows;
    return {participants:await active(client,teamId),signals,cursor:signals.at(-1)?.sequence??cursor,expiresAt:me.expires_at,maxParticipants:CHAT_LIMITS.participants};
  });
}

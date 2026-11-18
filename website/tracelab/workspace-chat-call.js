/** Team-scoped WebRTC audio. Signaling contains connection metadata, never recorded audio. */
export function createTeamVoiceCall({teamId,audioContainer,getOwnerId=()=>null,request=globalThis.fetch.bind(globalThis),onState=()=>{},onParticipants=()=>{},onError=()=>{},mediaDevices=globalThis.navigator?.mediaDevices,PeerConnection=globalThis.RTCPeerConnection,makeId=()=>crypto.randomUUID()}={}){
  let disposed=false,participantId=null,stream=null,cursor='0',pollTimer=null,heartbeatTimer=null,polling=null,muted=false,phase='idle',generation=0,hasRelay=false,ownerId=null;
  const peers=new Map(),controllers=new Set();
  const update=next=>{phase=next;onState({phase,muted,joined:!!participantId,hasRelay});};
  async function api(body,{keepalive=false,owner=ownerId}={}){const response=await request('/api/workspace/chat/call',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-Iznera-Chat-Owner':owner||''},body:JSON.stringify(body),keepalive});const data=await response.json();if(!response.ok){const error=new Error(data.error?.code||'call_failed');error.code=data.error?.code||'call_failed';throw error;}return data;}
  const activeSession=(epoch,id)=>!disposed&&generation===epoch&&!!id&&participantId===id;
  const livePeer=item=>activeSession(item.generation,item.participantId)&&peers.get(item.remoteId)===item&&item.connection.signalingState!=='closed';
  const send=(item,type,payload)=>livePeer(item)?api({command:'signal',teamId,participantId:item.participantId,toParticipantId:item.remoteId,type,payload},{owner:item.ownerId}):Promise.resolve();
  function dropPeer(id){const item=peers.get(id);if(!item)return;item.connection.onicecandidate=null;item.connection.ontrack=null;item.connection.onconnectionstatechange=null;item.connection.close();item.audio.pause();item.audio.srcObject=null;item.wrapper.remove();peers.delete(id);}
  function connectionFor(person,iceServers,epoch=generation,joined=participantId){if(!activeSession(epoch,joined))return null;let item=peers.get(person.id);if(item)return item;
    const connection=new PeerConnection({iceServers}),wrapper=document.createElement('div'),label=document.createElement('span'),audio=document.createElement('audio');
    wrapper.className='wchat-peer-audio';label.textContent=person.displayName;audio.autoplay=true;audio.controls=true;audio.setAttribute('aria-label',person.displayName);wrapper.append(label,audio);audioContainer.append(wrapper);
    item={connection,audio,wrapper,pendingIce:[],queue:Promise.resolve(),offered:false,restarted:false,generation:epoch,participantId:joined,ownerId,remoteId:person.id};peers.set(person.id,item);
    for(const track of stream?.getTracks()||[])connection.addTrack(track,stream);
    connection.onicecandidate=event=>{if(event.candidate&&livePeer(item))void send(item,'ice',event.candidate.toJSON()).catch(error=>{if(livePeer(item))onError(error.code||'call_failed');});};
    connection.ontrack=event=>{if(!livePeer(item))return;if(event.streams?.[0])audio.srcObject=event.streams[0];else {const remote=audio.srcObject||new MediaStream();remote.addTrack(event.track);audio.srcObject=remote;}void audio.play().catch(()=>{});};
    connection.onconnectionstatechange=()=>{if(!livePeer(item))return;const state=connection.connectionState;
      if(state==='connected')update('active');
      else if(state==='disconnected')update('reconnecting');
      else if(state==='failed'){update('reconnecting');if(item.participantId<person.id&&!item.restarted){item.restarted=true;item.queue=item.queue.then(()=>offer(item,true)).catch(error=>{if(livePeer(item))onError(error.code||'call_failed');});}else onError('call_failed');}
    };
    return item;
  }
  async function offer(item,restart=false){if(!livePeer(item)||item.connection.signalingState!=='stable')return;const description=await item.connection.createOffer(restart?{iceRestart:true}:undefined);if(!livePeer(item))return;await item.connection.setLocalDescription(description);if(!livePeer(item))return;await send(item,'offer',{type:description.type,sdp:description.sdp});if(livePeer(item))item.offered=true;}
  function reconcile(participants,iceServers=[],epoch=generation,joined=participantId){if(!activeSession(epoch,joined))return;const current=new Set(participants.map(person=>person.id));for(const id of peers.keys())if(!current.has(id))dropPeer(id);
    onParticipants(participants,participantId);
    for(const person of participants){if(person.id===joined)continue;const item=connectionFor(person,iceServers,epoch,joined);if(item&&joined<person.id&&!item.offered){item.offered=true;item.queue=item.queue.then(()=>offer(item)).catch(error=>{if(livePeer(item))onError(error.code||'call_failed');});}}
    if(participants.length===1&&participantId)update('active');
  }
  async function consume(packet,participants,iceServers,epoch,joined){if(!activeSession(epoch,joined))return;const person=participants.find(item=>item.id===packet.fromParticipantId);if(!person||person.id===joined)return;const item=connectionFor(person,iceServers,epoch,joined);if(!item)return;const pc=item.connection;
    item.queue=item.queue.then(async()=>{
      if(!livePeer(item))return;
      if(packet.type==='offer'){
        if(pc.signalingState!=='stable'){await pc.setLocalDescription({type:'rollback'});if(!livePeer(item))return;}
        await pc.setRemoteDescription({type:'offer',sdp:packet.payload.sdp});if(!livePeer(item))return;
        for(const candidate of item.pendingIce.splice(0)){await pc.addIceCandidate(candidate);if(!livePeer(item))return;}
        const answer=await pc.createAnswer();if(!livePeer(item))return;await pc.setLocalDescription(answer);if(!livePeer(item))return;await send(item,'answer',{type:answer.type,sdp:answer.sdp});
      }else if(packet.type==='answer'){
        if(pc.signalingState!=='have-local-offer')return;
        await pc.setRemoteDescription({type:'answer',sdp:packet.payload.sdp});if(!livePeer(item))return;for(const candidate of item.pendingIce.splice(0)){await pc.addIceCandidate(candidate);if(!livePeer(item))return;}
      }else if(packet.type==='ice'){
        if(pc.remoteDescription)await pc.addIceCandidate(packet.payload);else item.pendingIce.push(packet.payload);
      }
    }).catch(error=>{if(livePeer(item))onError(error.code||'call_failed');});
    await item.queue;
  }
  let iceServers=[];
  function refreshIceServers(next){if(!Array.isArray(next))return;const changed=JSON.stringify(next)!==JSON.stringify(iceServers);iceServers=next;hasRelay=iceServers.some(server=>(Array.isArray(server.urls)?server.urls:[server.urls]).some(url=>/^turns?:/.test(url)));if(changed)for(const item of peers.values()){const pc=item.connection;if(pc.signalingState!=='closed'&&typeof pc.setConfiguration==='function')try{pc.setConfiguration({...pc.getConfiguration(),iceServers});}catch{onError('call_failed');}}}
  async function poll(){if(!participantId||disposed||polling?.generation===generation&&polling?.participantId===participantId)return;const joined=participantId,epoch=generation,token={generation:epoch,participantId:joined},controller=new AbortController();polling=token;controllers.add(controller);
    try{const params=new URLSearchParams({team:teamId,participant:joined,after:cursor});const response=await request('/api/workspace/chat/call?'+params,{credentials:'same-origin',cache:'no-store',signal:controller.signal});const data=await response.json();if(!response.ok){const error=new Error();error.code=data.error?.code||'call_failed';throw error;}if(!activeSession(epoch,joined))return;
      reconcile(data.participants,iceServers,epoch,joined);for(const packet of data.signals||[]){await consume(packet,data.participants,iceServers,epoch,joined);if(!activeSession(epoch,joined))return;}cursor=data.cursor||cursor;
    }catch(error){if(activeSession(epoch,joined)&&error.name!=='AbortError'){if(['forbidden','unauthenticated','verification_required','call_expired'].includes(error.code)){leave();onError(error.code);}else {update('reconnecting');onError(error.code||'call_failed');}}}
    finally{controllers.delete(controller);if(polling===token)polling=null;if(activeSession(epoch,joined))pollTimer=setTimeout(poll,1800);}
  }
  async function heartbeat(){if(!participantId||disposed)return;const joined=participantId,epoch=generation,owner=ownerId;try{const data=await api({command:'heartbeat',teamId,participantId:joined},{owner});if(!activeSession(epoch,joined))return;refreshIceServers(data.iceServers);reconcile(data.participants,iceServers,epoch,joined);}catch(error){if(activeSession(epoch,joined)){if(['forbidden','unauthenticated','call_expired'].includes(error.code)){leave();onError(error.code);}else{update('reconnecting');onError(error.code||'call_failed');}}}finally{if(activeSession(epoch,joined))heartbeatTimer=setTimeout(heartbeat,10000);}}
  async function join(){if(disposed||participantId||phase==='requesting'||phase==='connecting')return;const attempt=++generation,joiningOwner=getOwnerId();ownerId=joiningOwner;if(!joiningOwner){onError('account_changed');return;}update('requesting');let acquired;
    try{
      if(!mediaDevices?.getUserMedia||!PeerConnection){const error=new Error();error.code='micUnavailable';throw error;}
      acquired=await mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      if(disposed||attempt!==generation){for(const track of acquired.getTracks())track.stop();return;}
      stream=acquired;muted=false;update('connecting');const id=makeId();const data=await api({command:'join',teamId,participantId:id},{owner:joiningOwner});
      if(disposed||attempt!==generation){for(const track of acquired.getTracks())track.stop();void api({command:'leave',teamId,participantId:id},{keepalive:true,owner:joiningOwner}).catch(()=>{});return;}
      participantId=id;cursor=data.signalCursor||'0';iceServers=data.iceServers||[];hasRelay=iceServers.some(server=>(Array.isArray(server.urls)?server.urls:[server.urls]).some(url=>/^turns?:/.test(url)));update('connecting');reconcile(data.participants,iceServers,attempt,id);void poll();heartbeatTimer=setTimeout(heartbeat,10000);
      for(const track of acquired.getTracks())track.addEventListener('ended',()=>{if(activeSession(attempt,id)){leave();onError('micDenied');}},{once:true});
    }catch(error){for(const track of acquired?.getTracks()||[])track.stop();if(!disposed&&attempt===generation){stream=null;update('idle');onError(error.name==='NotAllowedError'?'micDenied':error.name==='NotFoundError'?'micUnavailable':error.code||'call_failed');}}
  }
  function leave(){generation++;const previous=participantId,previousOwner=ownerId;participantId=null;polling=null;clearTimeout(pollTimer);clearTimeout(heartbeatTimer);for(const controller of controllers)controller.abort();controllers.clear();for(const id of [...peers.keys()])dropPeer(id);for(const track of stream?.getTracks()||[])track.stop();stream=null;muted=false;onParticipants([],null);update('idle');if(previous)void api({command:'leave',teamId,participantId:previous},{keepalive:true,owner:previousOwner}).catch(()=>{});}
  function toggleMute(){if(!stream||!participantId)return;muted=!muted;for(const track of stream.getAudioTracks())track.enabled=!muted;onState({phase,muted,joined:true,hasRelay});}
  const pagehide=()=>leave();globalThis.addEventListener?.('pagehide',pagehide);
  return {join,leave,toggleMute,get joined(){return !!participantId;},get busy(){return phase==='requesting'||phase==='connecting';},dispose(){leave();disposed=true;globalThis.removeEventListener?.('pagehide',pagehide);}};
}

import { shellT, workspaceErrorText } from './workspace-shell-i18n.js';
/** Server-backed adapter. It never writes private team records to localStorage. */
export async function createServerWorkspace({ request = globalThis.fetch.bind(globalThis), location = globalThis.location } = {}) {
  let snapshot;
  let status = 'server';
  let messageKey = 'server.loaded';
  let lastError = null;
  let serial = Promise.resolve();
  let queuedCommands = 0;
  const retryable = new Map();
  const listeners = new Set();
  function notify() { for (const listener of listeners) listener(snapshot); }
  async function responseData(response) {
    const data = await response.json();
    if (!response.ok) {
      const error = new Error();
      error.code = data.error?.code || `HTTP_${response.status}`;
      error.status = response.status;
      error.details = data.error?.details;
      error.message = workspaceErrorText(error);
      throw error;
    }
    return data;
  }
  async function load(project, team) {
    const params = new URLSearchParams();
    if (project) params.set('project', project);
    if (team) params.set('team', team);
    const response = await request(`/api/workspace?${params}`, { credentials: 'same-origin', cache: 'no-store' });
    const data = await responseData(response);
    if (data.needsOnboarding) { location.assign('/onboarding'); throw new Error(shellT('server.onboarding')); }
    snapshot = data; status = 'server'; messageKey = 'server.loaded'; lastError = null; notify();
    return data;
  }
  const params = new URLSearchParams(location.search);
  try { await load(params.get('project'), params.get('team')); }
  catch (error) {
    if (error.status === 401) location.assign(`/auth?mode=signin&next=${encodeURIComponent(location.pathname + location.search)}`);
    throw error;
  }
  function command(name, args) {
    const projectId = snapshot.activeProjectId;
    const signature = JSON.stringify({ name, projectId, args });
    queuedCommands++;
    const perform = async () => {
      status = 'syncing'; messageKey = 'storage.syncing'; lastError = null; notify();
      try {
        const project = snapshot.projects.find(item => item.id === projectId);
        let body = retryable.get(signature);
        if (!body) {
          body = JSON.stringify({ command: name, projectId: project?.id, expectedRevision: project?.serverRevision, requestId: crypto.randomUUID(), args });
          if (retryable.size >= 20) retryable.delete(retryable.keys().next().value);
          retryable.set(signature, body);
        }
        const response = await request('/api/workspace', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const data = await responseData(response);
        retryable.delete(signature);
        if (Array.isArray(data.projects)) snapshot = data;
        status = 'server'; messageKey = 'server.saved'; lastError = null; notify();
        return data.result;
      } catch (error) {
        if (error.status && error.status < 500) retryable.delete(signature);
        if (error.status === 409) {
          try { await load(projectId, snapshot.team.id); } catch { /* Keep the editor and original failure visible. */ }
        }
        if (!error.code) error.code = 'network';
        error.message = workspaceErrorText(error);
        status = 'failed'; lastError = error; notify(); throw error;
      }
    };
    const next = serial.then(perform, perform).finally(()=>{queuedCommands--;}); serial = next.catch(() => {}); return next;
  }
  async function refreshIfChanged({canApply=()=>true}={}){
    if(queuedCommands || status!=='server' || !canApply())return false;
    const basis=snapshot,teamId=snapshot.team.id,projectId=snapshot.activeProjectId;
    const metadata=await responseData(await request(`/api/workspace/revision?team=${encodeURIComponent(teamId)}`,{credentials:'same-origin',cache:'no-store'}));
    if(queuedCommands || status!=='server' || snapshot!==basis || !canApply())return false;
    const changed=metadata.team.name!==snapshot.team.name || metadata.team.timezone!==snapshot.team.timezone || metadata.role!==snapshot.role ||
      metadata.projects.length!==snapshot.projects.length || metadata.projects.some(item=>snapshot.projects.find(project=>project.id===item.id)?.serverRevision!==item.serverRevision);
    if(!changed)return false;
    const params=new URLSearchParams({team:teamId,project:projectId});
    const next=await responseData(await request(`/api/workspace?${params}`,{credentials:'same-origin',cache:'no-store'}));
    // Fetching must not replace a form opened or a write started during either
    // request. The next idle poll will use the same server revisions again.
    if(queuedCommands || status!=='server' || snapshot!==basis || !canApply())return false;
    snapshot=next;messageKey='server.loaded';lastError=null;notify();return true;
  }
  const api = {
    getState: () => snapshot,
    getProject: () => snapshot.projects.find(project => project.id === snapshot.activeProjectId),
    get storageStatus() { return status; },
    get storageMessage() { return lastError ? workspaceErrorText(lastError) : shellT(messageKey); },
    get serverContext() { return snapshot; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    selectProject: id => load(id, snapshot.team.id),
    refresh: () => load(snapshot.activeProjectId, snapshot.team.id),
    refreshIfChanged,
    selectTeam: id => load(undefined, id),
    exportProject() { return JSON.stringify(api.getProject(), null, 2); },
    previewImport: text => command('previewImport', [text]),
    importProject: (text, confirmation) => command('importProject', [text, confirmation]),
  };
  for (const name of ['createProject', 'addRecord', 'updateRecord', 'addLink', 'removeLink', 'hideRecord', 'restoreRecord', 'setNodePosition', 'resetNodePositions', 'addStudyRow', 'addStudyRows', 'createInvite', 'joinInvite']) {
    api[name] = (...args) => command(name, args);
  }
  return api;
}

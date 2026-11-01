"use client";

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { lifecycleCopy } from './lifecycle-copy';
import './lifecycle.css';
import { formatAccountDate } from '@/lib/account-date';
import { prepareOfflineSignout, finishOfflineSignout } from '../../../website/tracelab/workspace-offline-account.js';

type Locale = keyof typeof lifecycleCopy;
type State = { state: 'active' | 'pending' | 'purging'; requestId: string | null; purgeAfter: string | null; canCancel: boolean };
type Team = State & { id: string; name: string; role: string; canRequest: boolean };
type Status = { graceDays: number; account: State & { blockingTeams: { id: string; name: string }[] }; teams: Team[] };
type Preview = { teamId: string; name: string; counts: Record<'projects' | 'records' | 'members' | 'files' | 'reports' | 'chatMessages', number>; fileCount: number; knownBytes: number };
type Intent = { action: 'request_team' | 'cancel_team' | 'request_account' | 'cancel_account'; team?: Team; requestId?: string };

export function LifecycleSettings({ locale, email }: { locale: Locale; email: string }) {
  const copy = lifecycleCopy[locale];
  const [status, setStatus] = useState<Status | null>(null), [preview, setPreview] = useState<Preview | null>(null);
  const [intent, setIntent] = useState<Intent | null>(null), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false), [pending, setPending] = useState(false), [message, setMessage] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const busy = useRef(false), formHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/account/lifecycle', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error('error'); return response.json() as Promise<Status>; })
      .then(setStatus).catch(() => { if (!controller.signal.aborted) setMessage('error'); })
      .finally(() => { if (!controller.signal.aborted) setInitialLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => { if (intent) formHeading.current?.focus(); }, [intent]);
  const translated = (key: string) => key in copy ? copy[key as keyof typeof copy] : copy.error;
  const date = (value: string) => formatAccountDate(value, locale);
  async function request(body?: Record<string, unknown>) {
    const response = await fetch('/api/account/lifecycle', { credentials: 'same-origin', cache: 'no-store',
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.code === 'string' ? result.code : 'error');
    return result;
  }
  async function work(callback: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setMessage('');
    try { await callback(); } catch (error) { setMessage(error instanceof Error ? error.message : 'error'); }
    finally { busy.current = false; setPending(false); }
  }
  function open(value: Intent) { setIntent(value); setPassword(''); setConfirmation(''); setAcknowledged(false); setMessage(''); }
  function dismiss() { setIntent(null); setPassword(''); setConfirmation(''); setAcknowledged(false); }
  function refresh() { void work(async () => { setStatus(await request()); setPreview(null); }); }
  function review(team: Team) { void work(async () => { const result = await request({ action: 'preview_team', teamId: team.id }); setPreview(result.preview); dismiss(); }); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!intent) return;
    const current = intent;
    void work(async () => {
      let local: Awaited<ReturnType<typeof prepareOfflineSignout>> = null;
      let owner = '';
      if (current.action === 'request_account') {
        const response = await fetch('/api/account/session', { credentials: 'same-origin', cache: 'no-store' });
        const session = await response.json();
        if (!response.ok || !session.user?.id) throw new Error('unauthenticated');
        owner = session.user.id; local = await prepareOfflineSignout({ userId: owner, locale });
        if (!local) return;
      }
      const result = await request({ action: current.action, password,
        ...(current.action === 'request_team' ? { teamId: current.team!.id, confirmation } : {}),
        ...(current.action === 'request_account' ? { confirmation } : {}),
        ...(current.action.startsWith('cancel_') ? { requestId: current.requestId } : {}) });
      setStatus(result); setPreview(null); dismiss(); setMessage('saved');
      if (local) try { await finishOfflineSignout({ userId: owner, choice: local.choice }); } catch { setMessage('localKept'); }
    }).finally(() => setPassword(''));
  }
  function stateLine(value: State) {
    return value.state === 'active' ? null : <div className="lifecycle-state"><strong>{value.state === 'pending' ? copy.pending : copy.purging}</strong>
      {value.purgeAfter ? <p>{copy.due}: <time dateTime={value.purgeAfter}>{date(value.purgeAfter)}</time></p> : null}</div>;
  }
  const requesting = intent?.action.startsWith('request_');
  const confirmationMatches = !requesting || confirmation === (intent?.action === 'request_team' ? intent.team?.name : email);
  const actionableTeams = status?.teams.filter(team => team.canRequest || team.canCancel || team.state !== 'active') || [];
  return <section className="settings-panel lifecycle-settings" aria-labelledby="lifecycle-title">
    <div className="settings-section-title"><h2 id="lifecycle-title">{copy.title}</h2><button type="button" disabled={pending || initialLoading} onClick={refresh}>{copy.load}</button></div>
    <p className="settings-note">{copy.intro}</p>
    <p className="settings-note">{copy.grace}</p><p className="settings-note">{copy.backup}</p>
    {message ? <p role="status" className={message === 'saved' ? 'account-message' : 'account-message is-error'}>{translated(message)}</p> : null}
    {!status && !message ? <p role="status">{copy.loading}</p> : null}
    {status ? <>
      <div className="lifecycle-group"><h3>{copy.account}</h3><p className="settings-note">{copy.accountInfo}</p><p className="settings-note">{copy.drafts}</p>
        {stateLine(status.account)}
        {status.account.blockingTeams.length ? <div className="settings-note"><p>{copy.blocked}</p><ul>{status.account.blockingTeams.map(team => <li key={team.id}>{team.name}</li>)}</ul></div> : null}
        {status.account.state === 'active' ? <button type="button" disabled={pending || status.account.blockingTeams.length > 0} onClick={() => open({ action: 'request_account' })}>{copy.requestAccount}</button> : null}
        {status.account.canCancel && status.account.requestId ? <button type="button" disabled={pending} onClick={() => open({ action: 'cancel_account', requestId: status.account.requestId! })}>{copy.cancelRequest}</button> : null}
      </div>
      <div className="lifecycle-group"><h3>{copy.teams}</h3><p className="settings-note">{copy.teamsInfo}</p>
        {!actionableTeams.length ? <p className="settings-note">{copy.noTeams}</p> : <ul className="lifecycle-teams">{actionableTeams.map(team => <li key={team.id}>
          <h4>{team.name}</h4>{stateLine(team)}<div className="settings-actions">
            {team.canRequest ? <button type="button" disabled={pending} onClick={() => review(team)}>{copy.preview}</button> : null}
            {team.canCancel && team.requestId ? <button type="button" disabled={pending} onClick={() => open({ action: 'cancel_team', team, requestId: team.requestId! })}>{copy.cancelRequest}</button> : null}
          </div>
        </li>)}</ul>}
      </div>
    </> : null}
    {preview ? <div className="settings-confirm"><h3>{copy.previewTitle}: {preview.name}</h3><dl className="lifecycle-counts">{Object.entries(preview.counts).map(([key, value]) => <div key={key}><dt>{translated(key)}</dt><dd>{value}</dd></div>)}
      <div><dt>{copy.objects}</dt><dd>{preview.fileCount}</dd></div><div><dt>{copy.knownBytes}</dt><dd>{new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(preview.knownBytes / 1048576)} MiB</dd></div></dl>
      <button type="button" disabled={pending} onClick={() => { const team = status?.teams.find(item => item.id === preview.teamId); if (team?.canRequest) open({ action: 'request_team', team }); }}>{copy.requestTeam}</button>
    </div> : null}
    {intent ? <form className="settings-confirm lifecycle-confirm" onSubmit={submit} aria-labelledby="lifecycle-confirm-heading">
      <h3 id="lifecycle-confirm-heading" ref={formHeading} tabIndex={-1}>{requesting ? copy.confirmTitle : copy.cancelRequest}{intent.team ? ': ' + intent.team.name : ''}</h3>
      {requesting ? <><p className="settings-note">{copy.grace}</p><label>{intent.action === 'request_team' ? copy.confirmationTeam : copy.confirmationAccount}<input required maxLength={254} value={confirmation} autoComplete="off" disabled={pending} onChange={event => setConfirmation(event.target.value)} /></label></> : null}
      <label>{copy.password}<input required type="password" autoComplete="current-password" minLength={1} maxLength={128} value={password} disabled={pending} onChange={event => setPassword(event.target.value)} /></label>
      {requesting ? <label className="lifecycle-ack"><input type="checkbox" required checked={acknowledged} disabled={pending} onChange={event => setAcknowledged(event.target.checked)} /><span>{copy.acknowledge}</span></label> : null}
      <div className="settings-actions"><button type="submit" disabled={pending || !password || !confirmationMatches || (requesting && !acknowledged)}>{pending ? copy.busy : requesting ? copy.submit : copy.submitCancel}</button>
        <button type="button" disabled={pending} onClick={dismiss}>{copy.dismiss}</button></div>
    </form> : null}
  </section>;
}

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sourceConnections } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { disconnectSource, simulateSourceEvent } from "@/server/actions";
import { getActiveSeasonAndProject, listSubsystems } from "@/server/evidence";
import { ConnectForm, CsvImportForm } from "./forms";
import { Mono, Notice, PageHeader, SourceBadge, fmtDate } from "@/components/ui";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTeam();
  const conns = await db.select().from(sourceConnections).where(eq(sourceConnections.teamId, ctx.team.id)).orderBy(desc(sourceConnections.createdAt));
  const { project } = await getActiveSeasonAndProject(ctx.team.id);
  const subs = await listSubsystems(ctx.team.id, project?.id);
  const appUrl = process.env.APP_URL ?? "https://<your-host>";
  const onshapeConfigured = !!process.env.ONSHAPE_CLIENT_ID;
  const isDev = process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_SIMULATOR === "true";
  return (
    <div className="fade-in">
      <PageHeader title="Integrations" subtitle="Connect the tools your team already uses. Metadata only — we never ingest repository contents, and connector secrets are encrypted at rest." />
      {sp.error ? <div className="mb-4"><Notice tone="danger">{sp.error === "onshape_not_configured" ? "Onshape OAuth is not configured on this deployment (ONSHAPE_CLIENT_ID / SECRET). Your data is unaffected." : sp.error === "oauth_state" ? "OAuth state validation failed — the flow was restarted for safety." : "Connection failed. Nothing was changed."}</Notice></div> : null}
      {sp.connected ? <div className="mb-4"><Notice tone="success">{sp.connected} connected.</Notice></div> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Connected sources</h2>
            {conns.length === 0 ? (
              <p className="card p-4 text-sm text-text-2">No sources yet. Start with a photo, or connect GitHub on the right.</p>
            ) : (
              <ul className="card divide-y divide-border">
                {conns.map((c) => (
                  <li key={c.id} className="p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <SourceBadge provider={c.provider} />
                        <span className="font-medium">{c.label}</span>
                        <span className={`badge ${c.status === "active" ? "badge-success" : c.status === "pending" ? "badge-warning" : c.status === "error" ? "badge-danger" : ""}`}>{c.status}</span>
                      </span>
                      <Mono>{c.lastEventAt ? `last event ${fmtDate(c.lastEventAt, true)}` : "no events yet"}</Mono>
                    </div>
                    {c.status !== "disconnected" && (c.provider === "github" || c.provider === "telegram" || c.provider === "discord" || c.provider === "onshape") ? (
                      <div className="mt-2 rounded-md bg-surface-muted p-2">
                        <div className="text-xs text-text-3">Webhook URL {c.provider === "github" ? "(GitHub App / repository webhook, content-type JSON, push events, secret shown at creation)" : c.provider === "telegram" ? "(setWebhook with secret_token)" : "(send with X-Trace-Webhook-Secret header)"}</div>
                        <Mono className="block break-all !text-ink">
                          {appUrl}/api/webhooks/{c.provider}/{c.id}
                        </Mono>
                      </div>
                    ) : null}
                    {c.lastError ? <p className="mt-1 text-xs text-danger">{c.lastError}</p> : null}
                    {c.status === "pending" && c.provider === "onshape" ? <p className="mt-1 text-xs text-warning">Awaiting Onshape OAuth credentials on the server. The adapter, webhook route and data model are ready.</p> : null}
                    <div className="mt-2 flex gap-2">
                      {ctx.canOrganize && c.status !== "disconnected" ? (
                        <form action={disconnectSource}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="btn btn-sm btn-danger">Disconnect &amp; revoke</button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="csv" className="card p-5">
            <h2 className="font-semibold">CSV test-data import</h2>
            <p className="hint">Preview first; malformed numbers are reported, never coerced. Each row becomes a test with a provenance-linked source event.</p>
            <CsvImportForm subsystems={subs.map((s) => ({ id: s.id, name: s.name }))} />
          </section>

          {isDev ? (
            <section className="card border-warning/50 p-5">
              <h2 className="font-semibold">Development simulator</h2>
              <p className="hint">Injects a realistic provider event through the same normalization path as real webhooks. Clearly marked as simulated in metadata. Not available in production unless ENABLE_DEV_SIMULATOR=true.</p>
              <form action={simulateSourceEvent} className="mt-2 flex gap-2">
                {["github", "onshape", "telegram"].map((p) => (
                  <button key={p} name="provider" value={p} className="btn btn-sm">
                    Simulate {p}
                  </button>
                ))}
              </form>
            </section>
          ) : null}
        </div>
        <aside className="space-y-4">
          {ctx.canOrganize ? (
            <>
              <ConnectForm provider="github" title="GitHub" description="Create a webhook (or GitHub App) pointing at the URL shown after connecting. Push events → one source event per commit: SHA, author, branch, message, changed-file counts." fields={[{ name: "externalId", label: "Repository (owner/name)", placeholder: "team/orion-robot" }]} />
              <ConnectForm provider="onshape" title="Onshape" description={onshapeConfigured ? "Authorize via Onshape OAuth, then register a webhook for document lifecycle events." : "Server is missing ONSHAPE_CLIENT_ID / ONSHAPE_CLIENT_SECRET. You can pre-register the document; the connection stays pending until OAuth completes."} fields={[{ name: "externalId", label: "Document ID", placeholder: "d-…" }]} oauthHref={onshapeConfigured ? "/api/integrations/onshape?start=1" : undefined} />
              <ConnectForm provider="telegram" title="Telegram bot" description="Create a bot with @BotFather, paste a secret token you choose here, then call setWebhook with the URL and the same secret_token. Messages with #tags and photos become evidence." fields={[{ name: "externalId", label: "Chat / group id", placeholder: "-100…" }, { name: "secret", label: "Webhook secret token", placeholder: "choose a long random string", secret: true }]} />
              <ConnectForm provider="discord" title="Discord" description="Route channel messages to the webhook URL via a bot relay that sets the X-Trace-Webhook-Secret header (secret shown once after connecting)." fields={[{ name: "externalId", label: "Channel id", placeholder: "…" }]} />
            </>
          ) : (
            <p className="card p-4 text-sm text-text-2">Team leads and coaches manage integrations.</p>
          )}
          <div className="card p-4 text-xs text-text-3">Future adapters (Google Drive, OneDrive, other CAD) plug into the same provider interface: <Mono>src/integrations/normalize.ts</Mono>.</div>
        </aside>
      </div>
    </div>
  );
}

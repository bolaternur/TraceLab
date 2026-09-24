# Integrations

All connectors normalize into `NormalizedEvent` (`src/integrations/normalize.ts`) and insert append-only `source_events`. Webhook URL pattern: `POST {APP_URL}/api/webhooks/{provider}/{connectionId}`.

## GitHub
1. In the app: Integrations → GitHub → Connect (label + `owner/repo`). The webhook secret is shown once.
2. In GitHub: repository (or GitHub App) webhook → Payload URL above, content type `application/json`, secret from step 1, event `push`.
3. Ingest: one `commit` event per pushed commit (SHA, author login, branch, message, changed-file counts, URL). No repository contents.
4. Author mapping: set `config.identityMap = { "github-login": "student@email" }` on the connection to attribute commits to team members.
Verification: `X-Hub-Signature-256` HMAC; idempotent on `X-GitHub-Delivery`; `ping` acknowledged. For a full GitHub App, fill `GITHUB_APP_*` env and reuse the same handler.

## Onshape
OAuth 2.0 authorization-code flow at `/api/integrations/onshape?start=1` (requires `ONSHAPE_CLIENT_ID/SECRET`; state bound to an httpOnly cookie). After authorization, register an Onshape webhook to the URL above with header `X-Trace-Webhook-Secret` (generated per connection). Events become `cad_revision` / `cad_version` with document/workspace/element/microversion identity. Without credentials the connection stays `pending`; adapter, routes, model and tests are complete.

## Telegram
Create a bot with @BotFather. In the app enter a long random secret token. Call `setWebhook` with `url` = webhook URL and `secret_token` = the same secret. Messages/photos become events; `#tags` and `n/m` ratios are extracted as metadata only.

## Discord
Run a small relay bot that forwards channel messages as JSON to the webhook URL with `X-Trace-Webhook-Secret`. Attachments become artifact references.

## CSV
Integrations → CSV import: paste CSV, map columns (title, trials, successes, value, units, date), preview errors, import. Each row becomes a `tests` row plus a `csv_row` source event linked by `DERIVED_FROM`.

## Development simulator
Available outside production (or with `ENABLE_DEV_SIMULATOR=true`): injects realistic GitHub/Onshape/Telegram events marked `simulated: true` through the same insert path.

## Future adapters
Google Drive / OneDrive / other CAD: implement a normalizer returning `NormalizedEvent` and add the provider string to the webhook route allow-list.

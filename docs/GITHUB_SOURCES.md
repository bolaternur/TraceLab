# GitHub sources: bounded repository-webhook implementation

Implemented on 2026-10-27. This is an explicitly configured repository-webhook alternative, not a GitHub App installation or a verified external connection. It needs no personal access token, does not request repository write permissions, and does not fetch source code. No external webhook/account was created during implementation.

## Local workflow

The verified team lead opens **Sources → Configure webhook**, chooses an exact `owner/repository` and sees the project destination before creation. The application generates a random 256-bit secret, encrypts it at rest with `SECRETS_ENCRYPTION_KEY`, and displays it once. A replay of the configuration request does not reveal it again; rotate if it was lost. Secrets must never go into the repository or screenshots.

The endpoint is `/api/workspace/sources/github/<connection-id>`. The UI explains the GitHub repository settings: `Settings → Webhooks → Add webhook`, JSON content type and **Just the push event**. Setting up an actual remote webhook remains an explicit owner action. GitHub cannot call localhost; a real HTTPS deployment is required. Do not invent a successful provider connection from this configuration.

The source stays **Awaiting signed delivery** until a valid `push` or `ping` is processed. **Signed delivery received** means exactly that; a local signed fixture is not proof of live GitHub reachability. Rotation revokes the previous secret. Disconnect removes its ciphertext and blocks subsequent deliveries while retaining existing evidence. A revoked connector owner's membership blocks the next delivery.

## Integrity and limits

- Verify `X-Hub-Signature-256` over raw bytes with timing-safe HMAC comparison before parsing or writing a receipt. Match the exact configured repository and supported event.
- Stream limit 256 KiB even with missing/false Content-Length; at most 100 commits per push. Larger payloads are rejected in full, never quietly truncated.
- Store whitelisted metadata only: commit SHA, repository, ref, external actor label, original timestamp, received timestamp, exact constructed commit URL, delivery ID and forced-push flag. Email fields, code, file lists and unrelated payload keys are discarded. External labels do not become verified student identities.
- Receipt key is `(connection_id, delivery_id)` plus a raw payload hash. Repeated delivery is safe; changed bytes under the same ID conflict. Commit keys suppress repeated SHA imports across redeliveries within a connection.
- Durable receipt commits before processing. Processing uses one transaction for original source, map, annotation and workspace snapshot. Failure leaves a failed receipt and no partial evidence. UI retry or sender redelivery reuses it, with at most five processing attempts. There is no unattended background worker yet.
- Metadata sources enter canonical `source_events.status='inbox'` and are visible in the project timeline/graph. This is not a completed Inbox triage/iteration-closeout UI.
- Up to 10 active connections per team, 1000 receipts per connection, most recent 30 shown. Receipt pagination/retention and a purge-preview UI remain pending; no automatic deletion occurs.

## Authorization and database boundary

Session APIs recheck project/team membership. Configuration, rotation, disconnect and retry require student lead. Signed delivery processing rechecks a verified active student/lead owner and current connection secret. RLS protects receipts and all evidence. Runtime database role is neither table owner nor RLS bypass.

Migration `0011_workspace_sources.sql` revokes PUBLIC EXECUTE on the narrow credential lookup and three existing definer helpers. The trusted migration script grants exact signatures only to the validated runtime role. `workspace_github_credential(uuid)` can return only one eligible source configuration; it does not mutate data. Its encrypted secret is never returned by browser listing APIs.

## Verification

Set `RUN_WORKSPACE_SOURCES_DB_TESTS=true`, then run `node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/workspace-sources.test.ts tests/workspace-sources.db.test.ts`. This passed 12 tests in the isolated `tracelab_unified_*` database. Coverage: official signature fixture, body tamper/limits/schema/repository, secret encryption and listing redaction, replay/conflict, immutable external provenance, original dates/out-of-order deliveries, cross-team RLS, injected rollback/durable failed receipt/retry, rotation/disconnect and membership revocation. The database suite creates and deletes only its random fixtures. Without the explicit opt-in/environment, collection skips database tests without importing the database module.

`node --test website/tracelab/workspace-sources.test.mjs` checks RU/EN/KK key parity and truthful status copy. Browser UX verification is tracked separately in the implementation matrix.

Primary protocol references: [GitHub signature validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries), [GitHub event payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads#push). External App installation lifecycle, repository preview via live API, OAuth/token lifecycle, worker scheduling, automatic retry/backoff, contributor identity mapping and live GitHub verification remain unimplemented or externally gated.

The legacy GitHub webhook URL delegates to this same implementation. Other legacy provider webhooks and the incomplete Onshape OAuth endpoint fail closed with `integration_not_configured` (501); adding environment values cannot falsely activate them. The old `connectSource` action no longer writes credentials or claims “Connected”, and the old event simulator cannot populate a real team. The separate educational demo remains available.

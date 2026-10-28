# Account email setup

The current local configuration does not send email to an external service. Registration, confirmation, sign-in, sign-out and password reset use the existing `users` and `sessions` tables. Migration `0005_account_lifecycle.sql` adds verification, purpose-specific tokens, rate limits and an encrypted email outbox.

## Local development

Use the loopback-only development command (`npm run dev`). In `.env.local`, configure these names without committing their values:

```dotenv
APP_URL=http://localhost:3000
MAIL_TRANSPORT=local
MAIL_PREVIEW_ENABLED=true
MAIL_ENABLE_EXTERNAL_DELIVERY=false
SECRETS_ENCRYPTION_KEY=<a locally generated random secret of at least 32 characters>
DATABASE_URL=<the dedicated runtime-role database connection>
DATABASE_MIGRATION_URL=<the separate migration-owner connection>
```

`APP_URL` must exactly match the browser origin, including hostname and port. Do not switch between `localhost` and `127.0.0.1` during a flow. The runtime database role must not have `BYPASSRLS`. The migration owner is used only for migrations and administration.

Open `/auth?mode=signup`. Register a test address, then choose **View test messages** in the local inbox below the form. Open the confirmation link, confirm, and sign in. If registration occurred before the local inbox was enabled, request a new confirmation link in the same browser. The inbox is scoped to an HttpOnly browser cookie, so another browser does not see those messages.

To test reset, choose **Forgot your password?**, request a link, open the new local message and set a new password. Existing sessions must stop working; the previous password must fail. Links expire (confirmation: one hour; reset: 30 minutes), are single-use and are invalidated when replaced. Tokens are stored as hashes; encrypted outbox payloads contain the delivery link. The browser removes link fragments after reading them. Do not copy actual links or tokens into logs, tickets or screenshots.

The preview is denied in production even if `MAIL_PREVIEW_ENABLED=true`. It also requires a configured loopback origin and rejects remote forwarded addresses. Keep the development server bound to loopback. It is not a publicly hosted test mailbox.

Legacy users are deliberately not trusted automatically. They must request and complete email confirmation before using their existing account. No new duplicate identity system or development authentication bypass is provided.

## Prepare Resend

1. Create an account at [Resend](https://resend.com/).
2. Add a domain you control in its Domains area, publish the DNS records it supplies, and wait for verification. Choose an address on that verified domain for the sender.
3. Create an API key limited to sending email for the intended domain. Store it in the deployment's secret settings, never in browser code or Git.
4. Configure the production server with these names:

```dotenv
APP_URL=https://your-iznera-domain.example
MAIL_TRANSPORT=resend
MAIL_FROM=Iznera <accounts@your-verified-domain.example>
RESEND_API_KEY=<the server-side sending key>
MAIL_ENABLE_EXTERNAL_DELIVERY=true
MAIL_PREVIEW_ENABLED=false
SECRETS_ENCRYPTION_KEY=<a persistent random server-side encryption secret>
DATABASE_URL=<the production runtime-role database connection>
```

The variable is `MAIL_FROM`, not `EMAIL_FROM`. `APP_URL` must use HTTPS in production. Preserve the encryption key across restarts so queued messages remain readable. Rotation needs an explicit outbox re-encryption procedure; replacing the key alone makes existing queued payloads unreadable.

No external delivery occurs unless the transport, explicit delivery flag, API key, sender and encryption key are all present. Importing the adapter does not make a request. The adapter uses the [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email), an eight-second request timeout and a stable per-outbox idempotency key. It sends only the recipient address, sender, subject and plain-text account message.

On a configured deployment, use an address you control for a deliberate delivery test: create an account, inspect the delivery status in Resend, follow the link, confirm and sign in. Then request a reset and confirm session revocation. Failed provider calls retain a generic failure state without recording provider response bodies. Do not enable production delivery merely to run the automated tests.

## Delivery retries and operating limits

Account requests durably queue their message in the same transaction as the token. A Next.js post-response task attempts pending delivery. `flushAccountMail()` claims at most 20 messages per call, has a maximum of three attempts and uses a retry delay. Concurrent workers use row locking and the same idempotency key.

A protected `POST /api/account/mail-dispatch` endpoint can be called every minute by a trusted external scheduler with `Authorization: Bearer <CRON_SECRET>`. The secret must contain at least 32 characters. It is not put in the URL or committed in a workflow. The endpoint returns only delivery counts; it returns 503 when Resend is not configured, a delivery fails, or a failed message has exhausted its attempts/delivery window. It never returns recipient addresses, message text or action links. Tests cover the authorization and provider contract through mocks; no real provider delivery is implied. A scheduler and operator alert on 503 are still external configuration tasks, not automatically installed by this endpoint.

A failed delivery is also retried by a subsequent account email request. Sending email and committing a database transaction cannot be one atomic operation; provider idempotency handles repeated delivery attempts.

Expired tokens cannot authenticate. The local inbox displays only the last day's messages. An operational retention job for old outbox entries, tokens and rate-limit keys is still needed; display expiry is not physical deletion.

## Checks already run

- Unit checks cover normalization, password bounds, internal redirects, exact Origin validation, production/local inbox guards, request byte limits, translation parity and the Resend request contract through an injected mock.
- PostgreSQL checks cover verification, concurrent single-use links, link replacement/expiry/purpose separation, reset session revocation, explicit legacy re-verification, atomic rate limiting, hashed session rotation and stale credential rejection.
- Resend was not contacted. No real API key or sender domain was supplied. A real provider delivery test remains for the owner after setup.

Run unit checks with `npx vitest run tests/account.test.ts`. Database checks are opt-in: set `RUN_ACCOUNT_DB_TESTS=true`, load the dedicated local environment, then run `tests/account.db.test.ts`. The suite accepts only the dedicated development/test database names and cleans only its randomized `account-test-…@example.test` fixture accounts. Browser layout, focus, mobile behavior and full navigation are checked separately.

The account-settings screen now supports display name/locale and listing/revoking the account's own sessions. Changing the verified email and deleting the account remain unavailable; do not present them as complete.

# Security

## Threat model → mitigation
| Threat | Mitigation |
| --- | --- |
| Cross-team leakage | Every query filtered by `team_id` obtained from verified membership (`requireTeam`); media/export routes join `team_memberships`; identical 404 for missing vs foreign objects; DB tests in `tests/tenancy.db.test.ts`. |
| Malicious / reused invites | Random 72-bit codes, expiry, max uses, revocation; validity re-checked at join time. |
| Stolen source tokens | Connector secrets encrypted with AES-256-GCM (`SECRETS_ENCRYPTION_KEY`), decrypted only inside webhook/OAuth handlers, wiped on disconnect. |
| Webhook spoofing / replay | GitHub HMAC-SHA256 (`X-Hub-Signature-256`, constant-time compare); Telegram `secret_token`; Discord/Onshape shared secret header; delivery-id idempotency table; body size limit. |
| Accidental public sharing | No public URLs; exports downloadable only by members (personal exports only by subject). |
| Minors' PII | Minimal fields (email, display name, optional age category); no DOB; no location; no third-party analytics. |
| GPS metadata | Client canvas re-encode + server APP1 strip for JPEG; content sniffed by magic bytes; 15 MB limit. |
| Unauthorized coach editing | `canAuthorStudentContent` false for coaches; `addAnnotation` rejects non-`coach_note` fields; policy action `coach_edit_student_content` is always BLOCK. |
| AI context leakage / tenant mixing | Retrieval is team-scoped before any provider call; provider optional; outputs logged with hash. |
| Export of forbidden generated content | `createExport` gates `export_generated_content`; blocked attempts are recorded with status `blocked`. |
| Malicious uploads | Type sniffing, allow-list, size limits, `X-Content-Type-Options: nosniff`, inline images only from allow-listed types. |
| XSS through notes | React escaping everywhere; export HTML escapes all user content. |
| Role escalation | Role changes require lead/coach/org-admin; users cannot change their own status; platform role never settable via UI. |
| Session theft | httpOnly, SameSite=Lax, Secure in production, 30-day expiry stored server-side, sign-out deletes session row. |
| Privileged operations | Job runner requires `CRON_SECRET`; billing webhook requires provider signature. |

## Not yet implemented
- Rate limiting (add at the edge/proxy or with a token bucket in `jobs`-style table).
- Postgres RLS (ADR-003).
- Email verification / password reset flows (mail provider not configured; design keeps `users.email` unique and sessions server-side so these are additive).

Report issues to the address in `src/lib/brand.ts`.

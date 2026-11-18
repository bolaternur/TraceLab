# Privacy

## Data classes
| Class | Examples | Storage | Access |
| --- | --- | --- | --- |
| Account | email, display name, locale, optional age category | `users` | the user; team members see display name + email of teammates |
| Team evidence | source events, artifacts, tests, decisions, annotations, relations | team-scoped tables, private storage | active team members; coaches read-only for student content |
| Connector secrets | webhook secrets, OAuth tokens | encrypted column | server only |
| Operational | audit events, AI logs, exports, jobs | per team/org | leads, coaches, org admins as applicable |
| Analytics | event names + IDs, never content | `analytics_events` | operators |

## Controls
- Private by default; no public profiles, no public rankings.
- Personal contribution export: any student, any time (`/app/settings`, `/app/contribution`), never paywalled.
- Team export: student leads / coaches / org admins. Organization retention: admins (applies only to unlinked inbox events; never auto-deletes student reasoning).
- Deletion: Account settings provide password-confirmed account closure and lead-only team deletion requests, a team inventory preview and a seven-day cancellation period. Normal access closes on request; a trusted scheduled worker performs irreversible processing after the deadline. Team deletion includes registered private objects; account closure anonymizes the profile while retaining team-owned engineering evidence, authored explanations and ready reports with a technical author reference. Names inside authored text or downloaded files are not rewritten. Legacy team deletion and whole-prefix cleanup remain blocked. See [the lifecycle procedure and limits](ACCOUNT_LIFECYCLE.md).
- Photos: EXIF/GPS stripped; served through membership-checked routes with short private cache.
- Sensitive flag: leads/coaches can mark events sensitive for later redaction workflows.
- Notifications: opt-out per category; no streaks or guilt mechanics.

Offline drafts and photo bytes remain in owner-scoped IndexedDB until the server acknowledges them. The offline page offers a complete private ZIP of the draft text and actual photos, plus separate JSON/photo downloads. A draft archive can contain original EXIF/GPS and visible sensitive details. It is not a full team backup or an automatic queue import. Signout and account closure present a keep/backup/delete choice for pending drafts; local deletion affects only the current owner and requires explicit confirmation. Account settings provide a bounded own-account JSON snapshot with explicit exclusions for binary files, other authors, former-team content, raw provider payloads and secrets. It is not a complete team backup or full unrestricted personal-data archive.

The deletion worker commits the database change with an exact object-key manifest, then deletes objects with durable retries. Unresolved writes pause erasure; elapsed time never proves that a PUT finished. Technical deletion receipts and object keys remain private for reconciliation. Separate backups, downloaded files and device copies are outside automatic erasure. The operator must define actual backup retention and how deletion is reapplied after restoring a backup. Eleven isolated lifecycle scenarios and a combined synthetic DB+private-files restore passed locally; actual production/provider erasure and restoration remain unverified. See [the current lifecycle status](DATA_LIFECYCLE_STATUS.md).

## Youth considerations
Age is captured as a category, never a birth date. Organizations that need guardian consent can record eligibility state in `organizations.settings` and gate membership in their onboarding; this application provides the controls but does not itself certify legal compliance for any jurisdiction.

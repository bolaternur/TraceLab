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
- Deletion: team deletion requires typing the team name, writes an audit event and queues storage cleanup; connector disconnect wipes secrets.
- Photos: EXIF/GPS stripped; served through membership-checked routes with short private cache.
- Sensitive flag: leads/coaches can mark events sensitive for later redaction workflows.
- Notifications: opt-out per category; no streaks or guilt mechanics.

## Youth considerations
Age is captured as a category, never a birth date. Organizations that need guardian consent can record eligibility state in `organizations.settings` and gate membership in their onboarding; this application provides the controls but does not itself certify legal compliance for any jurisdiction.

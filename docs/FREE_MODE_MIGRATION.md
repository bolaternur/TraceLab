# Universal free mode migration

The approved product brief removes the pricing route, all subscription code and active plan fields.
Migration 0004 preserves historical data in the private tracelab_legacy schema:
organization_plans stores each previous value; subscriptions moves intact.
Teams, organizations, membership and evidence are not deleted. Existing migration files stay unchanged.

Before applying on a deployed database:
1. Stop application writes and scheduled jobs.
2. Make a pg_dump --format=custom backup and verify it can be restored into an isolated database.
3. Use npm run db:migrate, not db:push. The migrator runs this migration transactionally.
4. Deploy the matching application version and check organizations, teams and login.
5. Verify that /pricing and /api/webhooks/billing return 404.

Recovery while writes remain paused: restore the verified backup and the preceding application release.
For selective recovery, a database administrator can add organizations.plan and restore its values
from tracelab_legacy.organization_plans, then move tracelab_legacy.subscriptions back to public.
Do not erase the archive until the owner has approved a retention decision.

No live database migration is performed merely by adding this file.

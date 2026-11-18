# Team management — verified local scope

Implemented on 2026-10-27; reusable team codes added on 2026-10-28. The active workspace **Team settings** dialog uses `/api/workspace/team` and the existing team/membership/invitation tables. It does not create a separate permission system or organization administrator bypass.

## Available workflow

- Verified active members can read their team's name, time zone, default language and member display names/roles. The member list does not expose account email addresses. The UI declares the 200-member display limit and total count.
- An existing student lead can change team name/time zone/default RU/EN/KK language. A version check rejects stale settings, and the UI preserves the form with a refresh instruction. Dates elsewhere use the selected team's time zone after workspace refresh.
- A student lead can grant/revoke the student-lead role for existing student members, remove student access and explicitly restore it as student. A student or coach cannot self-promote. Students cannot appoint themselves or others as coach; existing coach/adult memberships cannot be changed through this student-management endpoint. Trusted adult/organization administration is still a separate pending capability.
- At least one active lead remains. A database advisory lock serializes competing changes; expected role/status checks reject stale transitions. Before/after roles and settings are audited in the same transaction.
- Revocation changes membership status; it does not delete student-authored records. The next workspace request is denied for the revoked user. Restoring access is explicit.
- The lead can see the latest 50 invitations, create a single-use student invitation (optional recipient email restriction), and revoke it. Tokens are returned only from creation, never in the list. No email is automatically sent; the owner chooses how to share the link. Revocation does not remove members who already joined.

## Joining with a team code

1. Each person registers with their own email, verifies it and signs in. Onboarding offers **I have a team code** or **Create a team**; participants should use the first option instead of creating a duplicate team.
2. A team lead creates the private team once. In **Project → Team code**, choose **Create team code**. The server issues an independent random code for that team, displayed as three groups of four characters. It accepts up to 50 members for 14 days. It is not a shared password or a special administrator code.
3. Copy the code or its join link immediately and share it only with intended participants. The plain code is shown only at creation. History shows kind, uses, expiry and revocation status; it does not reveal the code again. Codes are not sent by email automatically.
4. A participant uses onboarding or **Project → Join a team with a code** (`/join`). Case, spaces and hyphens are ignored for the 12-character code. Existing personal 43-character invitations keep their original case-sensitive behavior, including old `/onboarding?invite=…` links.
5. Joining adds only the student member role. The participant enters the same team/project as other accounts. Names, text and measurements remain attributed to their real authors; shared access does not permit overwriting another author's explanation.
6. The lead can revoke a code in **Project → Team settings → Invitations**. A revoked, expired or exhausted code rejects new joins. Revocation does not remove existing members; revoke a member's access separately when necessary. At most five shared codes may be active per team; revoke an unused one before issuing another.

Codes apply only to the Iznera instance whose website was used. A different team's code cannot grant access to the selected team. Localhost belongs to the current computer; teams on other computers need the deployed HTTPS site and configured verification email. See [pilot launch](PILOT_LAUNCH.md).

`workspace-invite-contract.ts`, `workspace-service.ts` and additive migration `0013_workspace_team_codes.sql` implement this workflow. `tests/team-join-ui.test.ts` checks accepted formatting, rejected ambiguous characters and semantic RU/EN/KK errors; backend invitation and real-database tests verify membership and code boundaries separately.

## Security implementation

`workspace-team-service.ts` runs through the existing verified-user transaction and checks team membership. Mutation routes enforce same-origin CSRF validation and bounded JSON bodies. Migration `0012_workspace_team_management.sql` adds only a settings version and two narrow SECURITY DEFINER functions with fixed search path, explicit caller/role validation and no PUBLIC EXECUTE. The trusted migration runner grants the validated runtime role exact signatures:

- `public.workspace_manage_member(uuid,uuid,text,text,text,text)`
- `public.workspace_update_team(uuid,text,text,text,integer)`

The normal runtime remains non-owner/NOBYPASSRLS. Raw membership writes have no generic RLS policy that would let a member escalate their role.

## Checks and remaining limits

With `RUN_WORKSPACE_TEAM_DB_TESTS=true`, `node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/workspace-team.db.test.ts` passed **6/6** real-database tests: scoped reads and unverified denial, settings/version/audit, API and direct-SQL adult-role escalation denial, access revocation with retained authorship, invitation revocation/acceptance denial, and concurrent last-lead protection. The suite creates random test users/teams and cleans only those fixtures.

`node --test website/tracelab/workspace-team.test.mjs` checks matching RU/EN/KK keys. Browser flow and broader product acceptance evidence are recorded separately in the implementation matrix. The view does not implement organization administration, adult identity verification, season archive administration, bulk roster import, complete paginated member history, or a user-facing audit-log browser.

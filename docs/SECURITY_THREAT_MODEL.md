# TraceLab security threat model and authorization boundaries

Status: implementation baseline for the pilot hardening work. TraceLab remains an internal codename pending naming clearance.

## Assets and trust boundaries

| Asset | Primary threat | Required boundary |
| --- | --- | --- |
| Student evidence and rationale | IDOR, cross-team reads/writes, coach overwrite | Active team membership, entity team match, append-only provenance |
| Sessions and credentials | Theft, brute force, replay | Hashed server-side tokens, rotation, expiry, rate limits, secure cookies |
| Competition policy | Tenant actor weakens global baseline | Global publishing restricted to `platform_admin`, complete reviewed matrix, fail closed |
| Private media and exports | Permanent/public URL, orphan files, deletion failure | Authorized route, private storage, prefix deletion, lifecycle receipt |
| Invites and roles | Race overuse, privilege resurrection/escalation | Atomic consume, explicit safe role transition, audit and rate limit |
| Offline evidence | Shared-device leakage, duplicate sync | User/team namespace, logout purge/warning, idempotent server sync |
| OAuth/webhook secrets | Replay, team switching, spoofing | One-time state, provider-scoped idempotency, encryption, bounded body |

## Capability matrix

| Capability | Student | Student lead | Coach | Org admin | Platform admin |
| --- | ---: | ---: | ---: | ---: | ---: |
| Author student rationale | Yes | Yes | No | No | No |
| Create normal capture | Yes | Yes | No | No | No |
| Invite student | No | Yes | Yes | Yes | Yes |
| Invite coach | No | No | Yes | Yes | Yes |
| Manage team membership | No | Limited | Yes | Yes | Yes |
| Select published policy pack | No | Yes | Yes | Yes | Yes |
| Publish global policy version | No | No | No | No | Yes |
| Delete team | No | Typed confirmation | No | Typed confirmation | Administrative recovery only |

## Tenant invariants

1. The authenticated session supplies user identity; client input never supplies the authoritative actor.
2. Every referenced entity is checked against the active team before mutation, including both endpoints of relations.
3. A membership must be active on every request. A UUID is not authorization.
4. Application guards remain mandatory after PostgreSQL RLS is introduced.
5. Unknown entity types, policy actions, stale policy versions, missing tenant context and missing production providers fail closed.

## Priority attack paths

1. Direct invocation of exported Server Actions with forged team/user IDs.
2. Tenant actor publishing or weakening a global competition policy.
3. Cross-team relation, subsystem parent, import, annotation and media identifiers.
4. Invite concurrency and reactivation of a formerly privileged membership.
5. Shared-device recovery of authenticated HTML or IndexedDB evidence after logout.
6. OAuth state replay/team switching and webhook delivery collisions.
7. Incomplete deletion or export that contradicts the user-facing privacy promise.

Database RLS, full auth lifecycle, durable private object storage and provider-backed email remain separate hardening stages; they must be complete before public pilot status.

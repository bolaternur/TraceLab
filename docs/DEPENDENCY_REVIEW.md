# Dependency review — 2026-09-28

Initial npm audit reported 5 affected packages: PostCSS (high) and four packages
in the drizzle-kit → @esbuild-kit/esm-loader → core-utils → esbuild chain (moderate).

PostCSS is pinned to 8.5.28. Only the core-utils nested esbuild is overridden to
0.25.12, the same version already used directly by drizzle-kit. No forced
downgrade of drizzle-kit and no migration history rewrite was performed.
This leaves the legacy loader present but removes the affected esbuild binary.

Validation: npm audit reports zero known vulnerabilities, production build,
typecheck, lint with zero warnings, unit and frontend suites pass.
drizzle-kit check --dialect=postgresql --out=drizzle passes.
The config-based check currently reports an AWS Data API credential validation
error despite the PostgreSQL dialect; migration execution is NOT certified by
the snapshot-only check. Resolve this before applying any new migration.
Database tests cannot connect to the configured local Postgres at 127.0.0.1:5432.

References:
- https://github.com/advisories/GHSA-fxqj-rqcc-2cmp
- https://github.com/advisories/GHSA-67mh-4wv8-2f99

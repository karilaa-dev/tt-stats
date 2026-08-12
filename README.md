# TT Stats

An analytics website for the current [`tt-bot`](https://github.com/karilaa-dev/tt-bot) PostgreSQL schema. PostgreSQL builds complete-bucket statistics snapshots on a fixed cadence; the web application is a responsive, non-blocking read layer over those snapshots.

The normal application connection remains read-only. Narrow `SECURITY DEFINER` functions let authenticated operators manage only the two fixed TT Stats `pg_cron` jobs. The application intentionally has no login system; access control belongs at the reverse proxy.

## Stack

- Node.js 22+, TanStack Start, TanStack Router, React, TypeScript, Vite, and Nitro
- TanStack Query for non-blocking SSR hydration, background refreshes, and previous-data retention
- TanStack Charts for accessible responsive SVG time series
- TanStack Table for ranked data and pagination
- TanStack Form for the Telegram chat lookup
- shadcn/ui `base-nova` with Base UI and Tailwind CSS 4
- PostgreSQL through `pg`

TanStack Charts is currently pre-alpha. The lockfile pins the tested release used by this project.

## Requirements

- Node.js 22.12 or newer
- npm
- A current tt-bot v6 PostgreSQL database
- PostgreSQL 11+ with [`pg_cron`](https://github.com/citusdata/pg_cron) 1.5+ available
- A reverse proxy that authenticates every application request except the health check

Copy the example environment file and replace every placeholder:

```bash
cp .env.example .env.local
```

Required runtime variables:

```dotenv
DB_URL=postgresql://readonly-user:password@host:5432/ttbot-db

BOT_TOKEN=12345:telegram-bot-token
BOTSTAT_ACCESS_KEY=botstat-access-key
BOTSTAT_NOTIFY_ID=1234567
```

Optional variables:

```dotenv
DB_POOL_SIZE=5
# Server-only database-owner connection for guided setup/repair.
DB_ADMIN_URL=postgresql://database-owner:password@host:5432/ttbot-db
BOTSTAT_BASE_URL=https://www.botstat.io
```

`DB_ADMIN_URL` is used only by the confirmed setup action on
`/dashboard/jobs`. It must target the same database as `DB_URL` and is never
sent to the browser. You can omit it when the runtime role can install the
objects itself, or remove it after setup if future in-app repairs are not
needed.

PostgreSQL refreshes the completed rolling 24-hour snapshot every five minutes
and daily-backed snapshots at 00:07 UTC. Browsers poll inexpensive snapshot
tables every minute or every 15 minutes, depending on the dataset, while keeping
the previous result visible. User lookup, paginated history, CSV export, and
Botstat remain live operations.

All configuration is server-only. The production build does not require runtime secrets, allowing an image to be built before secrets are injected.

## PostgreSQL installation and application role

`pg_cron` must be present in `shared_preload_libraries` and configured for the
application database before installing the schedules. Set `cron.timezone` to
`UTC` so the daily expression runs at 00:07 UTC. Follow the upstream setup
instructions for the PostgreSQL distribution in use.

After the host-level pg_cron prerequisites are in place, the Database jobs page
can diagnose and install the additive schema, fixed jobs, and runtime grants.
It accepts only the two cron expressions; job names and SQL commands are fixed
server-side. The page does not create source indexes because those use
`CREATE INDEX CONCURRENTLY`; apply `database/002_stats_snapshot_indexes.sql`
separately as an administrator.

Create a dedicated application role and grant its live-read access as a database owner:

```sql
CREATE ROLE tt_stats LOGIN PASSWORD 'use-a-strong-generated-password';
GRANT CONNECT ON DATABASE "ttbot-db" TO tt_stats;
GRANT USAGE ON SCHEMA public TO tt_stats;
GRANT SELECT ON TABLE public.users, public.videos, public.music TO tt_stats;
```

Then back up the current schema and apply the additive installation files. The
index file must run outside an explicit transaction because it uses
`CREATE INDEX CONCURRENTLY`:

```bash
psql "$ADMIN_DATABASE_URL" -f database/002_stats_snapshot_indexes.sql
psql "$ADMIN_DATABASE_URL" -f database/001_stats_snapshot_schema.sql
psql "$ADMIN_DATABASE_URL" -v app_role=tt_stats \
  -f database/003_stats_snapshot_grants.sql
psql "$ADMIN_DATABASE_URL" -f database/004_stats_snapshot_pg_cron.sql
```

The final file seeds both snapshots and installs only these named jobs:

- `tt-stats-rolling-24h` — `*/5 * * * *`
- `tt-stats-daily` — `7 0 * * *`

Verify `tt_stats_cache.refresh_metadata` and `cron.job_run_details` before
deploying the web application. Do not grant the application role writes to the
snapshot tables or direct access to `cron.job` and `cron.job_run_details`.

For rollback, first redeploy the preceding web version and then run
`database/rollback_stats_snapshots.sql` as an administrator. It unschedules TT
Stats jobs and drops only the additive cache schema; source indexes are retained.

## Local development

`DB_URL` may point to a local PostgreSQL server, for example `postgresql://tt_stats:password@127.0.0.1:5432/ttbot-db`.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. To run the interface without PostgreSQL in development, set `TT_STATS_FAKE_DATA=true`; example lookup IDs are `123456789`, `-1009876543210`, and `9007199254740993`.

Useful commands:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Database integration tests are opt-in locally because they recreate the `users`, `videos`, and `music` tables in the configured test database. Never target a production database:

```bash
RUN_DATABASE_INTEGRATION=1 \
TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:5432/tt_stats_test \
npm test
```

Full job-management integration tests additionally require a pg_cron-enabled
test server and are guarded by `RUN_PG_CRON_INTEGRATION=1`.

## Routes

- `/dashboard` — private-user and group overview
- `/dashboard/analytics` — registration, video, and music time series
- `/dashboard/detailed` — linkable scope and range filters
- `/dashboard/users` — responsive user/group lookup, paginated recent downloads, and streaming CSV history
- `/dashboard/referrals` — top referral values
- `/dashboard/other` — file mode, languages, top downloaders, and Botstat
- `/dashboard/jobs` — fixed database schedules, run history, and asynchronous run-now controls
- `/api/health` — detail-free database/configuration health check

The health endpoint returns only `{"status":"ok"}` with HTTP 200 or `{"status":"unavailable"}` with HTTP 503.

## Reverse-proxy authentication

The application contains no login page, credentials, cookies, sessions, middleware guards, or authorization checks. The CSV endpoint and TanStack server functions are also unguarded at the application layer.

Keep the application origin private and make the reverse proxy the only network path to it. Protect the entire origin, not only `/dashboard`; if the health check must remain public, exempt only `/api/health`. Forward the original host/protocol headers and do not expose the Nitro listener directly to an untrusted network.

## Dokploy and Railpack

Connect this repository as a Node.js application. The package scripts build with Vite and start Nitro's Node server from `.output/server/index.mjs`; the server honors the platform-provided `PORT`.

The checked-in `railpack.json` keeps development dependencies available during the image build, even when the deployment environment sets npm's legacy `production` option. Vite and the Tailwind/Vite plugins are build-time dependencies and must be installed before `npm run build`.

Set the health check path to `/api/health`. Keep PostgreSQL private where possible and allow only the deployment network to reach it.

## Security and privacy

- The database connection should use the constrained PostgreSQL role described above.
- Reverse-proxy authentication is required because every data route is public inside the application.
- Aggregate browser queries read database snapshots without blocking navigation; user lookups remain live and fresh for one minute.
- Job wrappers resolve fixed commands internally. Browser input can change only the cron expression and active state of the two TT Stats jobs.
- Botstat verification sends every stored `users.user_id`, including private users and negative group IDs, to the configured Botstat.io endpoint. The UI requires explicit confirmation.
- Treat `BOT_TOKEN`, `BOTSTAT_ACCESS_KEY`, and the exported IDs as sensitive; they are never intentionally logged.

## Attribution and license

TT Stats is adapted from the database-backed statistics in [`tt-bot` v5.4.6](https://github.com/karilaa-dev/tt-bot/tree/v5.4.6/stats), created by Kyryl Andreiev. Changes include a web interface, current v6 schema mapping, completed UTC-duration buckets displayed in each visitor's timezone, PostgreSQL-managed snapshots, streaming CSV, and constrained job controls.

This repository follows tt-bot's Creative Commons Attribution-NonCommercial 4.0 International licensing posture. See [LICENSE.md](LICENSE.md).

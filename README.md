# TT Stats

An analytics website for the current [`tt-bot`](https://github.com/karilaa-dev/tt-bot) PostgreSQL schema. PostgreSQL builds complete-bucket statistics snapshots on a fixed cadence; the web application is a responsive, non-blocking read layer over those snapshots.

The normal statistics read path is read-only. Guided setup can use the same
non-superuser `DB_URL` for the fixed TT Stats schema and schedules after an
explicit confirmation. Narrow `SECURITY DEFINER` functions let authenticated
operators manage only the two fixed TT Stats `pg_cron` jobs. The application
intentionally has no login system; access control belongs at the reverse proxy.

## Stack

- Node.js 22.12+, [Astro](https://astro.build/) with the Node adapter, React islands, and TypeScript
- Astro Actions for validated server calls; TanStack Query for background refreshes and previous-data retention
- TanStack Charts for accessible responsive SVG time series
- TanStack Table for ranked data and pagination
- TanStack Form for the Telegram chat lookup
- [Rare UI](https://www.rareui.com/) Bounce Sidebar and Animated Counter, with Base UI controls and Tailwind CSS 4
- PostgreSQL through `pg`

TanStack Charts is currently pre-alpha. The lockfile pins the tested release used by this project.

## App structure

Astro routes live in `src/pages`. Each dashboard page hydrates its own React island, sharing the shell in `components/dashboard/dashboard-shell.tsx`. Filters and lookup pagination stay in the URL and support browser back/forward. `src/actions` validates server inputs and calls the existing PostgreSQL query layer. Database and credential modules are blocked from browser builds.

The notification monitor starts with the dev server and with `bun run start`, and closes its listeners on shutdown. `bun run build` bundles it separately as `dist/monitor.mjs`.

The workspace uses horizontal desktop navigation and a mobile bottom dock with a full-section menu. The overview pairs exact daily totals with cache efficiency, an all-chat traffic chart, and a lifetime ledger. Audience selection stays in the URL. User lookup uses a split desktop workspace and a compact stacked mobile layout. Analytics loads interactive charts near the viewport and keeps chart summaries visible while the chart module loads. The original [Rare UI](https://www.rareui.com/components) sidebar and counter sources remain in `components/ui` for reference; the dashboard no longer loads their animation runtime.

## Requirements

- [Bun](https://bun.sh/) 1.4.2, pinned in `.bun-version` and `package.json`
- A tt-bot v6 PostgreSQL database, verified against v6.0.10
- PostgreSQL 11+ with [`pg_cron`](https://github.com/citusdata/pg_cron) 1.5+ available
- A reverse proxy that authenticates every application request except the health check

Copy the example environment file and replace every placeholder:

```bash
cp .env.example .env.local
```

Required runtime variables:

```dotenv
DB_URL=postgresql://database-user:password@host:5432/ttbot-db

BOT_TOKEN=12345:telegram-bot-token
BOTSTAT_ACCESS_KEY=botstat-access-key
BOTSTAT_NOTIFY_ID=1234567
```

Optional variables:

```dotenv
DB_POOL_SIZE=5
BOTSTAT_BASE_URL=https://www.botstat.io

# Configure exactly one video-inactivity notification destination:
VIDEO_INACTIVITY_WEBHOOK_URL=https://example.com/webhooks/tt-stats
# VIDEO_INACTIVITY_NTFY_URL=https://ntfy.sh/private-topic
# VIDEO_INACTIVITY_NTFY_TOKEN=optional-bearer-token
```

When a destination is configured, the app checks `public.videos` at startup and
every minute. The rolling PostgreSQL refresh also emits a transactional `NOTIFY`
after each successful run so it can trigger an immediate check without making
the monitor depend on that job's schedule or active state. It sends a warning
after five minutes without a download and one urgent follow-up at ten minutes
of total inactivity. A download after at least five quiet minutes sends a
recovery notification that the bot is working and resets the escalation cycle.
Listener connections recover automatically, delivery failures retry on the next
check, and PostgreSQL state plus an advisory lock prevent duplicate alerts
across restarts and multiple app instances. The Database jobs page includes a
test button that sends a notification without changing monitor state. Generic
webhooks receive JSON; ntfy destinations receive the message and priority
headers expected by an ntfy topic URL.

After upgrading an installation where `DB_URL` owns `tt_stats_cache`, use
**Update database definitions** on the Database jobs page once. If the schema
owner and runtime `DB_URL` role are separate, apply
`database/001_stats_snapshot_schema.sql` as the schema owner, then reapply
`database/003_stats_snapshot_grants.sql` with `app_role` set to the runtime role.
The diagnostics and notification card report missing monitor-state grants.

The guided setup action on `/dashboard/jobs` uses `DB_URL`, but the role must not
be a PostgreSQL superuser. The page checks the limited grants below and requires
an explicit confirmation before it creates or repairs TT Stats objects. The URL
is never sent to the browser.

PostgreSQL refreshes the completed rolling 24-hour snapshot every five minutes
and daily-backed snapshots at 00:07 UTC. Browsers poll inexpensive snapshot
tables every minute or every 15 minutes, depending on the dataset, while keeping
the previous result visible. User lookup, paginated history, CSV export, and
Botstat remain live operations.

The rolling charts use 48 completed 30-minute buckets. All-time snapshots keep
daily history, while the read API groups unusually long histories to at most 720
lossless chart intervals. Invalid pre-2000 event epochs are excluded from shared
statistics so sentinel values cannot expand a graph back to 1970.

All configuration is server-only. The production build does not require runtime secrets, allowing an image to be built before secrets are injected.

## PostgreSQL installation and application role

`pg_cron` must be present in `shared_preload_libraries` and configured for the
application database before installing the schedules. Set `cron.timezone` to
`UTC` so the daily expression runs at 00:07 UTC. Follow the upstream setup
instructions for the PostgreSQL distribution in use.

After the host-level pg_cron prerequisites are in place, the Database jobs page
can diagnose and install the additive schema, fixed jobs, and runtime grants.
It never creates extensions or changes PostgreSQL configuration. It accepts
only the two cron expressions; job names and SQL commands are fixed server-side.
The page does not create source indexes because those use
`CREATE INDEX CONCURRENTLY`; apply
`database/002_stats_snapshot_indexes.sql` separately as an administrator.

Create a dedicated login role without cluster-wide attributes:

```sql
CREATE ROLE tt_stats LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS PASSWORD 'use-a-strong-generated-password';
```

The role needs only these database-scoped privileges:

- `CONNECT` on the tt-bot database.
- `TEMPORARY` because refresh procedures build transaction-local staging
  tables.
- `USAGE` on `public` and `SELECT` on `public.users`, `public.videos`, and
  `public.music` for snapshots, live lookup, history, and CSV export.
- `USAGE` on `cron` so its own fixed jobs can be scheduled and managed.
- `CREATE` on the tt-bot database only for the initial guided install or to
  recreate a missing schema. It can be revoked after installation; updating
  definitions in an owned schema does not change schedules.
- Ownership of the additive `tt_stats_cache` objects created by guided setup,
  including the small persistent video-inactivity escalation state.
  Browser-facing code still exposes only snapshot reads, fixed management
  operations, and the configured notification test.

It does not need `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`,
`BYPASSRLS`, or privileges on any other database in the cluster.

After configuring and restarting pg_cron, run the prerequisite file once as a
PostgreSQL administrator. It creates only the pg_cron extension and grants the
limited privileges above:

```bash
psql "$ADMIN_DATABASE_URL" -v app_role=tt_stats \
  -f database/000_stats_snapshot_prerequisites.sql
psql "$ADMIN_DATABASE_URL" -f database/002_stats_snapshot_indexes.sql
```

Then use `/dashboard/jobs` to install or repair the schema and fixed schedules.
For a fully manual installation, apply `001` and `004` through `DB_URL`; use
`003` when granting runtime access to a separate existing application role.

The final file seeds both snapshots and installs only these named jobs:

- `tt-stats-rolling-24h` — `*/5 * * * *`
- `tt-stats-daily` — `7 0 * * *`

Verify `tt_stats_cache.refresh_metadata` and the sanitized run history on the
Database jobs page before deploying the web application.

For rollback, first redeploy the preceding web version and then run
`database/rollback_stats_snapshots.sql` as an administrator. It unschedules TT
Stats jobs and drops only the additive cache schema; source indexes are retained.

## Upgrading an existing deployment

After deploying a new TT Stats build, open `/dashboard/jobs` and use **Update
database definitions** when diagnostics report an update. This applies the
additive snapshot changes, including `breakdown.cache_hits`, and queues both
snapshot rebuilds. Wait for both rebuilds to succeed. Deploying application code
alone does not update the installed PostgreSQL definitions.

Apply `database/002_stats_snapshot_indexes.sql` separately with `psql` as the
source-table owner, outside a transaction. The tt-bot v6.0.10 source indexes
include a BRIN time index and a user-first history index; neither replaces TT
Stats' time-first B-tree index for the monitor's latest-download lookup. A bot
migration that replaces `videos` may require reapplying the TT Stats indexes.

The monitor runs at most one check per web process. Failed checks discard their
database connection so an active query or aborted transaction cannot be reused
by dashboard requests. PostgreSQL's statement deadline precedes the client read
deadline. Repeated timeouts after the definitions and indexes are installed still
require checking database load and connectivity.

Compatibility tests use the source-table definitions from
[tt-bot v6.0.10](https://github.com/karilaa-dev/tt-bot/blob/v6.0.10/src/db/migrations.ts),
including `users.richads_last_shown_at`, `video_details`, and the video history
foreign key and delivery constraints. TT Stats reads download events from
`videos` and does not count cache entries in `video_details` as downloads.

## Local development

`DB_URL` may point to a local PostgreSQL server, for example `postgresql://tt_stats:password@127.0.0.1:5432/ttbot-db`.

```bash
bun install --frozen-lockfile
bun run dev
```

Open <http://localhost:3000>. To run the interface without PostgreSQL in development, set `TT_STATS_FAKE_DATA=true`; example lookup IDs are `123456789`, `-1009876543210`, and `9007199254740993`.

All scripts explicitly use Bun as their runtime. Astro retains its Vite pipeline and `@astrojs/node` adapter, whose standalone output runs on Bun. The notification monitor uses `Bun.build`. PostgreSQL pooling, LISTEN/NOTIFY, and cursor-based CSV streaming retain `pg` and `pg-query-stream`.

The test suite runs Vitest on Bun to preserve per-file jsdom environments, hoisted mocks, and asynchronous fake timers. Use `bun run test`, which invokes the configured suite, rather than Bun's separate `bun test` runner.

Useful commands:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run start
```

Database integration tests are opt-in locally because they recreate the `users`, `video_details`, `videos`, and `music` tables in the configured test database. Never target a production database:

```bash
RUN_DATABASE_INTEGRATION=1 \
TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:5432/tt_stats_test \
bun run test
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

The application contains no login page, credentials, cookies, sessions, middleware guards, or authorization checks. The CSV endpoint and Astro Actions at `/_actions/*` are also unguarded at the application layer.

Keep the application origin private and make the reverse proxy the only network path to it. Protect the entire origin, not only `/dashboard`; if the health check must remain public, exempt only `/api/health`. Forward the original host/protocol headers and do not expose the Bun listener directly to an untrusted network.

## Dokploy and Railpack

Connect this repository as a Bun application. `bun run build` builds Astro and the notification monitor. `bun run start` starts the monitor and Astro's standalone server on Bun from `dist/server/entry.mjs`. Set `HOST=0.0.0.0` and the platform-provided `PORT`. Supply production secrets through the platform environment. Bun automatically loads `.env` files, including `.env.local`, so keep local secret files out of the deployment image.

Railpack detects Bun from `packageManager` and `bun.lock`. The checked-in `railpack.json` installs the frozen lockfile with development dependencies for the Astro build and starts the application with Bun.

Set the health check path to `/api/health`. Keep PostgreSQL private where possible and allow only the deployment network to reach it.

## Security and privacy

- The database connection should use the constrained PostgreSQL role described above.
- Reverse-proxy authentication is required because every data route is public inside the application.
- Aggregate browser queries read database snapshots without blocking navigation; user lookups remain live and fresh for one minute.
- Job wrappers resolve fixed commands internally. Browser input can change only the cron expression and active state of the two TT Stats jobs.
- The optional notification monitor can update only its singleton escalation-state row; webhook and ntfy credentials remain server-only.
- Botstat verification sends every stored `users.user_id`, including private users and negative group IDs, to the configured Botstat.io endpoint. The UI requires explicit confirmation.
- Treat `BOT_TOKEN`, `BOTSTAT_ACCESS_KEY`, notification URLs/tokens, and the exported IDs as sensitive; they are never intentionally logged.

## Attribution and license

The Bounce Sidebar and Animated Counter are from [Rare UI](https://www.rareui.com/), by Swami Malode. Their source has been adapted for Astro navigation, dashboard icons, accessibility, and reduced motion. Rare UI permits personal and commercial use and modification; do not resell its components as a kit.


TT Stats is adapted from the database-backed statistics in [`tt-bot` v5.4.6](https://github.com/karilaa-dev/tt-bot/tree/v5.4.6/stats), created by Kyryl Andreiev. Changes include a web interface, current v6 schema mapping, completed UTC-duration buckets displayed in each visitor's timezone, PostgreSQL-managed snapshots, streaming CSV, and constrained job controls.

This repository follows tt-bot's Creative Commons Attribution-NonCommercial 4.0 International licensing posture. See [LICENSE.md](LICENSE.md).

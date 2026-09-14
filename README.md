# TT Stats

An analytics website for the current [`tt-bot`](https://github.com/karilaa-dev/tt-bot) PostgreSQL schema. PostgreSQL builds complete-bucket statistics snapshots on a fixed cadence; the web application is a responsive, non-blocking read layer over those snapshots.

The normal statistics read path is read-only. Guided setup can use the same
non-superuser `DB_URL` for the fixed TT Stats schema and schedules after an
explicit confirmation. Narrow `SECURITY DEFINER` functions let authenticated
operators manage only the two fixed TT Stats `pg_cron` jobs. Aggregate statistics and ranked-video previews are public. Telegram OAuth gives
users access to their own statistics, history, media, and CSV exports. A shared
admin token at `/admin` protects Operations and lookup of other accounts.

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
- HTTPS for production admin sessions

Copy the example environment file and replace every placeholder:

```bash
cp .env.example .env.local
```

Required runtime variables:

```dotenv
DB_URL=postgresql://database-user:password@host:5432/ttbot-db

# Required only to enable admin access; use a random token of at least 32 characters.
ADMIN_TOKEN=
```

Optional variables:

```dotenv
DB_POOL_SIZE=5
# Optional Telegram-calculated MAU; configure all three:
BOT_TOKEN=12345:telegram-bot-token
TELEGRAM_API_ID=123456
TELEGRAM_API_HASH=your-32-character-api-hash

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
the previous result visible. Personal and admin user lookup, paginated history, and CSV
export remain live operations.

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
- `USAGE` on `public` and `SELECT` on `public.users`, `public.videos`,
  `public.music`, and `public.video_details` for media previews, snapshots,
  live lookup, history, and CSV export.
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

`bun run dev` stays in the foreground and prints startup and request logs,
including in agent terminals. The script sets `ASTRO_DEV_BACKGROUND=1` to prevent
Astro 7 from spawning another background process. Host and port flags still work:
`bun run dev --host 0.0.0.0 --port 3001`. Use the URL printed at startup; Astro
selects another port if the requested one is occupied. Stop the server with Ctrl+C.

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
- `/dashboard/me` — Telegram login, personal statistics, filtered history, and CSV export
- `/admin` — the only admin login screen
- `/dashboard/users` — admin-only user/group lookup, filtered history, and CSV export
- `/dashboard/videos` — public most-downloaded videos by period, ranked by unique chats with public media previews
- `/dashboard/referrals` — top referral values
- `/dashboard/other` — file mode, languages, and top downloaders
- `/dashboard/jobs` — fixed database schedules, run history, and asynchronous run-now controls
- `/api/health` — detail-free database/configuration health check

The health endpoint returns only `{"status":"ok"}` with HTTP 200 or `{"status":"unavailable"}` with HTTP 503.

## Login and access

Configure `TELEGRAM_OAUTH_CLIENT_ID` and `TELEGRAM_OAUTH_CLIENT_SECRET` from
**Login Widget** in your bot's @BotFather settings. Use Telegram's default RS256
signing algorithm. Register the website origin and the exact callback URL:

```text
https://tt-stats.karilaa.dev/api/auth/telegram/callback
```

`APP_ORIGIN` defaults to `https://tt-stats.karilaa.dev`. Set it consistently when
building and running a deployment on another domain. Local OAuth development
may use an explicitly registered localhost HTTP callback; production requires
HTTPS. The build needs no OAuth secret. Missing configuration leaves public
statistics usable and shows a login-unavailable message.

The server uses authorization code flow, PKCE S256, single-use state and nonce,
and signature-verified ID tokens. Only `openid profile` is requested. The
verified Telegram `id` claim selects bot records; the OIDC `sub` is not a bot
user ID. Tokens and client secrets are never returned to the browser.

Client authentication follows Telegram's documented
`Authorization: Basic base64(client_id:client_secret)` format. Credentials are
not form-encoded before Base64 encoding; encoding an underscore as `%5F`, for
example, changes the secret Telegram receives and results in `invalid_client`.

Telegram can return an OAuth error with HTTP 200. A Telegram-specific adapter
marks these error responses as HTTP 400 internally so `openid-client` reports
the actual provider error instead of a misleading missing-access-token error.
Successful responses are unchanged and undergo the library's full validation.

If Telegram approves a login but the site reports that it could not be verified,
check the application log for `[telegram-login] callback failed`. It records only
allowlisted error codes, failure reasons, claim names, and algorithm names, never
tokens, credentials, or profile values. Nested library errors are inspected to
distinguish failures sharing `OAUTH_INVALID_RESPONSE`. For example,
`missing_nonce` means the ID token omitted the requested nonce,
`unexpected_signing_algorithm` includes the returned `algorithm`, and
`invalid_access_token` indicates an unsupported access-token response format.
`invalid_client` indicates rejected OAuth client credentials;
`invalid_grant` indicates a rejected code, redirect URI, or PKCE verifier. A JWT
validation error includes the failing claim name when available. Keep RS256
selected in BotFather and verify that the server clock is correct. After changing
configuration or restarting, start a new login instead of reusing a callback URL.

Telegram sessions last seven days in RAM and use opaque HttpOnly cookies.
Logout revokes the current session. Login transactions expire after ten minutes.
A restart ends all Telegram sessions and clears rate limits. Run one app process
and one replica; these stores are intentionally not shared across instances.
There are no session or rate-limit database tables and no Redis requirement.

Users can read only their own account's records. Group records belong to the
group ID and cannot be attributed to individual members from this schema.
Navigation always links to **My Profile**; signed-out visitors see the Telegram
login button on that page. Download history defaults to all time, with compact
rows on desktop and stacked details on mobile. Preferences show language names.
History has optional **From date** and **Through date** controls. Both use the
browser's local calendar; the full end date is included, even on daylight-saving
transition days. The server receives UTC boundaries and uses an exclusive upper
bound. Changing filters resets pagination to page one; pagination and browser
back/forward preserve the selected dates, media type, and ordering.
**Downloaded by others** and **You were first** show posts downloaded by at
least one other distinct chat. The latter requires a known first-downloader
status for the account. These views default to **Most downloaded by others**;
**Newest first** remains available. Comparisons use all recorded history,
including events outside the selected dates, and happen before pagination.
Only records with a stable `video_details_id` participate in these comparisons.
Legacy downloads remain in history, but do not receive other-downloader or
first-downloader badges and do not match either discovery filter. Saved URLs are
not used to infer that two legacy downloads refer to the same video.
Repeated downloads remain separate history events. Popularity comparisons run
once per distinct candidate post and use the indexes in
`database/002_stats_snapshot_indexes.sql`; ordinary history only compares posts
on the requested page. CSV export continues to include the full history.
Personal activity offers 31 days (daily), 90 days (weekly), one year (monthly),
and all time (monthly). PostgreSQL filters by account using the existing history
index before aggregating. Longer periods load on demand and stay fresh in the
browser cache for five minutes; the initial daily chart reuses the profile data.
Public media is limited to representative download IDs in the published Top
videos snapshots. Private media requires ownership or admin access; an owner's
preview does not depend on the rankings schema being installed or current.
Metadata failures log a sanitized database error category under
`[media] metadata unavailable`. All files
continue through the server proxy; the Telegram Bot API 20 MB limit remains.

Set `ADMIN_TOKEN` to a random value of at least 32 characters. Admin login is
available only at `/admin`; protected page links redirect there. The existing
eight-hour signed admin session is separate from Telegram login. An admin token
does not create a Telegram identity. Admin-only menus, downloader identities,
and operational diagnostics are hidden from other visitors.

## Rate limits and production security

Rate limits apply to verified Telegram account IDs across all their sessions.
Anonymous traffic and login attempts use the trusted client IP. Verified admins
are exempt from usage limits. A login attempt without admin authentication is
still limited. Static assets and the detail-free health endpoint are excluded.

| Class | Replenishment | Burst |
| --- | --- | --- |
| Dynamic pages and data | 120/minute | 60 |
| Media metadata | 60/minute | 20 |
| Media streams and ranges | 240/minute | 60 |
| CSV exports | 5/10 minutes | 2 |
| Login attempts | 10/10 minutes | 5 |

Use the `RATE_LIMIT_<CLASS>_COUNT` and `RATE_LIMIT_<CLASS>_BURST` overrides in
`.env.example`. Four media streams may be active per non-admin identity.
Completion, disconnect, cancellation, and stream failure release their slots.
HTTP 429 includes `Retry-After`; browser data requests respect the cooldown.
Bounded stores reject excess entries instead of evicting blocked identities.

The trusted proxy is part of the security boundary. Dokploy/Traefik must discard
client-supplied forwarding headers and supply the real client IP in
`X-Forwarded-For`. Only trust configured upstream proxy addresses. The backend
port must be reachable only by this proxy, never directly from the internet.
Astro's hostname allowlist is not a substitute for this network restriction.

Serve only `dist/client` as public static assets. Never mount the repository,
`dist/server`, environment files, or dependency directories in a public file
server. The app blocks sensitive paths and source maps, enforces a 16 KB body
limit, rejects cross-origin mutations, and disables shared caching of private
responses. Production CSP hashes Astro scripts and the theme initializer;
inline styles remain permitted for the component and chart libraries.

## Deploying the new rankings

The unique-chat ranking is schema version 7. Install the updated definitions
through Operations or the documented manual SQL procedure, and apply the new
indexes from `database/002_stats_snapshot_indexes.sql` outside a transaction.
Rebuild rolling and daily snapshots so all four ranking periods have
`ranking_version = 2`. The app refuses to show old event-count rankings while
that refresh is pending. Install and refresh before switching production traffic
to the new build.

The source bot tables are not rewritten. Added source indexes support identity
and first-download comparisons. Personal history comparisons require a stable
video ID and skip legacy links. Timestamp gaps produce an unknown first
downloader rather than treating a cache miss as proof of being first.

Validation includes `bun run lint`, `bun run typecheck`, `bun run test`,
`bun run build`, `bun run test:browser`, and
`bun scripts/check-production-proxy.mjs`. Database integration requires an
explicit `TEST_DB_URL` whose database name includes `test`; the suite destroys
only that disposable test schema. Browser tests include production CSP checks
and therefore require a current build.

## Telegram chat details

Opening a specific user or group in `/dashboard/users` fetches its name, chat
type, and optional `@username` through Telegram's
[`getChat`](https://core.telegram.org/bots/api#getchat). Set `BOT_TOKEN` to the
bot that has access to those chats. No `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`,
or personal login is required. The lookup uses the existing admin session.

Telegram details load independently of saved chat records and download history.
Missing usernames, inaccessible chats, missing configuration, and temporary
failures have explicit fallback messages. IDs remain visible. Successful reads
are cached for one hour per bot and chat in server memory, with up to 500 cached
entries; concurrent reads for the same chat share a request. Failures are cached
for one minute, or longer when Telegram requests a retry delay. Requests time out
after eight seconds. Only display fields reach the browser; bot credentials and
raw Telegram errors stay on the server. Fake-data mode displays labeled sample
profiles without calling Telegram.

## Saved media and popular videos

User download history includes **View media** for videos and image albums.
Previews use the current `video_details.telegram_files` cache, so older events
without linked or saved media show an unavailable message and retain the original
post link. Cache entries may change after a download; previews are not an archive
of the exact file originally delivered.

Set `BOT_TOKEN` to the same bot that owns the saved files. Previewing media does
not require `TELEGRAM_API_ID` or `TELEGRAM_API_HASH`. The app checks the stored
`telegram_bot_id` before retrieving files. Media streams through an authenticated
endpoint; credentials and Telegram file URLs never reach the browser. Telegram's
[hosted Bot API](https://core.telegram.org/bots/api#getfile) limits downloads to
20 MB. Larger, expired, or unsupported files can still be opened at the original
post.

**Other downloaders** is available only to admins. It lists other users and
groups sharing a video identity and links to their user lookup pages. The
selected chat is excluded. Personal history shows anonymous counts and a
separate first-downloader badge regardless of cache status.

**Top videos** at `/dashboard/videos` is public and shows up to 1,000 videos per
period: 24 hours, 7 days, 31 days, and Total. Published Top videos previews are
public, other previews require ownership or admin access, and arbitrary user
lookups require admin access. Ranking counts distinct chats, counting each group
as one chat and excluding placeholder ID zero. It excludes image albums.
Linked events are grouped by `video_details_id`; unlinked legacy events are
grouped by exact shared URL and cannot be merged across URL aliases. This is a
snapshot for each period. The 24-hour ranking updates every five minutes and
ends at the last completed half-hour. The 7- and 31-day rankings use complete UTC
days and refresh daily, together with Total. Records with missing timestamps
appear only in Total. Page reads use the stored rank index; opening or paging
this view does not scan download history. The background jobs calculate
distinct-chat counts across every candidate before selecting the top 1,000 and keep the previous snapshot
readable until the new one commits.

After upgrading, open Operations and use **Update database definitions**, which
queues both rolling and daily rebuilds. Wait for the selected period to finish.
Until then, visitors see an unavailable message and admins see setup instructions. The page displays its own snapshot timestamp. Separate
runtime roles also need the updated grants in `003_stats_snapshot_grants.sql`.

Existing runtime roles need `SELECT` on `public.video_details`. Reapply
`database/003_stats_snapshot_grants.sql` as the database administrator with
`app_role` set to the runtime role. Setup diagnostics check this permission.

## Telegram MAU

Overview shows Telegram's own monthly active user count, fetched through MTProto using `users.getUsers` with `inputUserSelf`. Telegram documents the count as `user.bot_active_users`, which can be absent for small bots. The HTTP Bot API does not expose this field. This metric is independent of the dashboard's audience and period filters.

Configure `BOT_TOKEN`, `TELEGRAM_API_ID`, and `TELEGRAM_API_HASH`. Obtain the API ID/hash at [my.telegram.org/apps](https://my.telegram.org/apps). No personal Telegram session or phone login is needed. Authorization is kept only in server memory; the integration does not call `getUpdates`, change webhooks, or send messages. Reads are coalesced and cached for 12 hours per app instance, including failures. The browser also checks every 12 hours while the dashboard is open. Telegram updates the underlying count once every 24 hours. Missing configuration, unpublished counts, and failures have separate states and never display as zero. Fake-data mode shows a labeled sample count. Optional Telegram configuration does not affect database health checks.

References: [Telegram user fields](https://core.telegram.org/constructor/user), [bot-accessible users.getUsers](https://core.telegram.org/method/users.getUsers), and [bot authorization](https://core.telegram.org/method/auth.importBotAuthorization).

## Dokploy and Railpack

Connect this repository as a Bun application. `bun run build` builds Astro and the notification monitor. `bun run start` starts the monitor and Astro's standalone server on Bun from `dist/server/entry.mjs`. Set `HOST=0.0.0.0` and the platform-provided `PORT`. Supply production secrets through the platform environment. Bun automatically loads `.env` files, including `.env.local`, so keep local secret files out of the deployment image.

Set `APP_ORIGIN` to the public HTTPS origin at build time and runtime; it configures Astro's site and allowed proxy hostname as well as the OAuth callback. Keep origin checking enabled. `bun scripts/check-production-proxy.mjs` tests the built server with proxy headers and confirms that unrelated origins remain blocked.

Railpack detects Bun from `packageManager` and `bun.lock`. Keep its generated install step: it copies the package manifest and lockfile before running `bun install --frozen-lockfile`, including the development dependencies needed by Astro. Replacing `steps.install.commands` also removes those copy commands and causes a missing `package.json` error. The checked-in `railpack.json` only sets the Bun start command. CI builds the deployment image with Railpack 0.15.4, matching Dokploy.

Set the health check path to `/api/health`. Keep PostgreSQL private where possible and allow only the deployment network to reach it.

## Security and privacy

### Database request progress

Database reads, saved-media metadata, and CSV exports show a cancellable dialog
after 650 ms. Fast requests keep their inline loading state. Popularity sorting
reports completed comparison batches; CSV exports report processed rows. Remaining
time is estimated from completed work. Other queries use the previous request's
duration when available, with an approximate percentage. A first request with no
measurable progress stays indeterminate rather than inventing a percentage.

History comparisons start with 64 distinct stable video IDs to show progress
promptly, then use batches of up to 1,024. Legacy links never trigger comparison
queries. Joins compare each batch together using the bot's video identity index.
Those indexes still improve performance on large databases. Completed comparisons are reused
across pages, dates, media filters, and sorting for two minutes. The cache is
account-scoped, limited to 50,000 comparisons and approximately 16 MB per process.
Counts and first-downloader badges in these filtered views can therefore lag by
up to two minutes. Histories above 20,000 distinct stable video IDs use the database-only
ranking path to bound application memory. No new database objects are required.

Progress and cancellation use `/api/tasks`, bound to the verified browser session
or trusted anonymous IP. Requests have a two-minute deadline, a limit of eight
active tasks per session, and a global limit of 500. Progress checks share one
batched request every 1.5 seconds and respect read cooldowns. Cancellation remains
available during a cooldown. Closing private views or logging out cancels their
requests. These controls affect reads; admin job mutations retain their existing
job controls.

PostgreSQL cancellation uses the application's own checked-out backend ID and
the same database role. It needs no superuser or `pg_signal_backend` grant.
Reserve two additional database connections beyond `DB_POOL_SIZE` for cancellation.
The read connection is discarded after cancellation, and the existing statement
timeout remains the fallback if the control connection cannot be reached.
See [PostgreSQL's cancellation permissions](https://www.postgresql.org/docs/17/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL).

All task state and cached comparisons live in RAM and disappear on restart.
Keep one application process, as with login sessions and usage limits.

### Troubleshooting history requests

Server logs under `[database]` report failed queries, queries taking at least one
second, and a heartbeat every five seconds while a query is pending. The logs
include the request ID, query ID, stage, elapsed time, connection wait time, pool
usage, comparison batch size and progress, and a sanitized PostgreSQL error code.
`waiting_for_connection` means SQL has not started; `executing` means PostgreSQL
has received the query and may be executing or waiting for a database lock.
Cancellation failures are logged too. SQL, query parameters, download links,
account IDs, credentials, and raw exception messages are excluded.

Temporarily set `DB_QUERY_DEBUG=true` and restart to also log every query start,
successful completion, and comparison-cache hit count. Reproduce the request and
collect the lines with the same `requestId`, then disable verbose logging.

The build includes a read-only diagnostic command. Run it on the application's
network with its existing `DB_URL` environment variable:

```sh
bun dist/diagnose-history.mjs <user-id>
# Inspect the first comparison's plan without executing that comparison:
bun dist/diagnose-history.mjs <user-id> --explain
```

The command runs the same popularity-history code used by the website. It reports
database settings, table-size estimates, index structure, query timings, and
result counts. Plan output omits conditions and literals. It uses one read-only
connection, a 30-second statement timeout, a two-minute overall deadline, and
supports Ctrl+C cancellation. It does not create indexes or change database data.
Connection errors and query failures exit nonzero. `--explain` still reads the
account's candidate identities but does not run the comparison or fetch history.
Never use the integration tests or `check-database-progress.mjs` against the real
database; those checks modify their isolated test database.

### Access controls

- The database connection should use the constrained PostgreSQL role described above.
- Server authorization protects mutations and individual user data, including direct action and CSV requests.
- Aggregate queries read database snapshots. User histories refresh every minute; cached popularity comparisons expire after two minutes.
- Job wrappers resolve fixed commands internally. Browser input can change only the cron expression and active state of the two TT Stats jobs.
- The optional notification monitor can update only its singleton escalation-state row; webhook and ntfy credentials remain server-only.
- Treat `ADMIN_TOKEN`, `BOT_TOKEN`, `TELEGRAM_API_HASH`, notification URLs/tokens, and the exported IDs as sensitive; they are never intentionally logged.

## Attribution and license

The Bounce Sidebar and Animated Counter are from [Rare UI](https://www.rareui.com/), by Swami Malode. Their source has been adapted for Astro navigation, dashboard icons, accessibility, and reduced motion. Rare UI permits personal and commercial use and modification; do not resell its components as a kit.


TT Stats is adapted from the database-backed statistics in [`tt-bot` v5.4.6](https://github.com/karilaa-dev/tt-bot/tree/v5.4.6/stats), created by Kyryl Andreiev. Changes include a web interface, current v6 schema mapping, completed UTC-duration buckets displayed in each visitor's timezone, PostgreSQL-managed snapshots, streaming CSV, and constrained job controls.

This repository follows tt-bot's Creative Commons Attribution-NonCommercial 4.0 International licensing posture. See [LICENSE.md](LICENSE.md).

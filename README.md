# TT Stats

An analytics website for the current [`tt-bot`](https://github.com/karilaa-dev/tt-bot) PostgreSQL schema. It recreates the database-backed statistics from the bot's v5.4.6 stats module in a responsive dashboard and adds its manual Botstat.io verification action.

The application is read-only: it does not create tables, run migrations, or write to the bot database. It intentionally has no application-level authentication; access control belongs at the reverse proxy.

## Stack

- Node.js 22+, TanStack Start, TanStack Router, React, TypeScript, Vite, and Nitro
- TanStack Query for SSR hydration and five-minute client-side server-state caching
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
BOTSTAT_BASE_URL=https://www.botstat.io
```

All configuration is server-only. The production build does not require runtime secrets, allowing an image to be built before secrets are injected.

## Read-only PostgreSQL role

Use a dedicated login that can only connect and read the three required tables. Run equivalent grants as a database owner, substituting the actual database and role names:

```sql
CREATE ROLE tt_stats LOGIN PASSWORD 'use-a-strong-generated-password';
GRANT CONNECT ON DATABASE "ttbot-db" TO tt_stats;
GRANT USAGE ON SCHEMA public TO tt_stats;
GRANT SELECT ON TABLE public.users, public.videos, public.music TO tt_stats;
```

If the bot uses a schema other than `public`, update the role's `search_path` and grants accordingly. Do not grant `INSERT`, `UPDATE`, `DELETE`, `CREATE`, or ownership.

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

## Routes

- `/dashboard` — private-user and group overview
- `/dashboard/analytics` — registration, video, and music time series
- `/dashboard/detailed` — linkable scope and range filters
- `/dashboard/users` — user/group lookup and streaming CSV history
- `/dashboard/referrals` — top referral values
- `/dashboard/other` — file mode, languages, top downloaders, and Botstat
- `/api/health` — detail-free database/configuration health check

The health endpoint returns only `{"status":"ok"}` with HTTP 200 or `{"status":"unavailable"}` with HTTP 503.

## Reverse-proxy authentication

The application contains no login page, credentials, cookies, sessions, middleware guards, or authorization checks. The CSV endpoint and TanStack server functions are also unguarded at the application layer.

Keep the application origin private and make the reverse proxy the only network path to it. Protect the entire origin, not only `/dashboard`; if the health check must remain public, exempt only `/api/health`. Forward the original host/protocol headers and do not expose the Nitro listener directly to an untrusted network.

## Dokploy and Railpack

Connect this repository as a Node.js application. The package scripts build with Vite and start Nitro's Node server from `.output/server/index.mjs`; the server honors the platform-provided `PORT`.

Set the health check path to `/api/health`. Keep PostgreSQL private where possible and allow only the deployment network to reach it.

## Security and privacy

- The database connection should use the read-only PostgreSQL role described above.
- Reverse-proxy authentication is required because every data route is public inside the application.
- Browser server-state is considered fresh for five minutes unless an operator presses refresh.
- Botstat verification sends every stored `users.user_id`, including private users and negative group IDs, to the configured Botstat.io endpoint. The UI requires explicit confirmation.
- Treat `BOT_TOKEN`, `BOTSTAT_ACCESS_KEY`, and the exported IDs as sensitive; they are never intentionally logged.

## Attribution and license

TT Stats is adapted from the database-backed statistics in [`tt-bot` v5.4.6](https://github.com/karilaa-dev/tt-bot/tree/v5.4.6/stats), created by Kyryl Andreiev. Changes include a web interface, current v6 schema mapping, exact UTC ranges, zero-filled time buckets, streaming CSV, and server-side query orchestration.

This repository follows tt-bot's Creative Commons Attribution-NonCommercial 4.0 International licensing posture. See [LICENSE.md](LICENSE.md).

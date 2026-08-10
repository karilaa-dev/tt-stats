# TT Stats

An authenticated analytics website for the current [`tt-bot`](https://github.com/karilaa-dev/tt-bot) PostgreSQL schema. It recreates the database-backed statistics from the bot's v5.4.6 stats module in a responsive Next.js dashboard and adds its manual Botstat.io verification action.

The application is read-only: it does not create tables, run migrations, or write to the bot database.

## Stack

- Node.js 22+, Next.js 16 App Router, React, and TypeScript
- shadcn/ui `base-nova` with Base UI, Tailwind CSS 4, and Recharts
- PostgreSQL through `pg`
- One environment-configured administrator account with signed 12-hour sessions
- Five-minute cached aggregate queries with authenticated manual invalidation

## Requirements

- Node.js 22.12 or newer
- npm
- A current tt-bot v6 PostgreSQL database

Copy the example environment file and replace every placeholder:

```bash
cp .env.example .env.local
```

Required runtime variables:

```dotenv
DB_URL=postgresql://readonly-user:password@host:5432/ttbot-db
STATS_USERNAME=admin
STATS_PASSWORD=replace-with-a-strong-password
SESSION_SECRET=replace-with-at-least-32-random-bytes

BOT_TOKEN=12345:telegram-bot-token
BOTSTAT_ACCESS_KEY=botstat-access-key
BOTSTAT_NOTIFY_ID=1234567
```

Optional variables:

```dotenv
DB_POOL_SIZE=5
BOTSTAT_BASE_URL=https://www.botstat.io
```

All configuration is server-only. The production build does not read these variables, allowing Railpack to build an image before runtime secrets are injected.

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

Open <http://localhost:3000>. Useful commands:

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
- `/dashboard/users` — user/group lookup and protected streaming CSV history
- `/dashboard/referrals` — top referral values
- `/dashboard/other` — file mode, languages, top downloaders, and Botstat
- `/api/health` — public, detail-free database/configuration health check

The health endpoint returns only `{"status":"ok"}` with HTTP 200 or `{"status":"unavailable"}` with HTTP 503.

## Dokploy and Railpack

Connect this repository as a Node.js application and configure the runtime variables above. No custom build command, start command, Dockerfile, or `railpack.json` is needed. Railpack detects `package.json` and `package-lock.json`, installs dependencies, runs `npm run build`, and starts the app with `npm start`. `next start` automatically uses the platform-provided `PORT`.

Set the health check path to `/api/health`. Keep the database private where possible and allow the deployment network to reach PostgreSQL.

## Security and privacy

- Password and username checks compare fixed-length SHA-256 digests with `timingSafeEqual`.
- Session cookies are HttpOnly, SameSite=Lax, Secure in production, and expire after 12 hours.
- Changing either administrator credential invalidates existing sessions.
- Failed login throttling is per Node process. Multiple replicas should add distributed rate limiting at the proxy or edge.
- Every data path, action, and CSV export revalidates authorization; `proxy.ts` is only an optimistic redirect layer.
- Aggregate data may be five minutes stale until its cache expires or an administrator presses refresh.

Botstat verification sends every stored `users.user_id`, including private users and negative group IDs, to the configured Botstat.io endpoint. The UI requires explicit confirmation. Treat `BOT_TOKEN`, `BOTSTAT_ACCESS_KEY`, and the exported IDs as sensitive; they are never intentionally logged.

## Attribution and license

TT Stats is adapted from the database-backed statistics in [`tt-bot` v5.4.6](https://github.com/karilaa-dev/tt-bot/tree/v5.4.6/stats), created by Kyryl Andreiev. Changes include a web interface, current v6 schema mapping, exact UTC ranges, zero-filled time buckets, protected CSV streaming, and server-side authentication.

This repository follows tt-bot's Creative Commons Attribution-NonCommercial 4.0 International licensing posture. See [LICENSE.md](LICENSE.md).

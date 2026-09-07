# LeadPilot

Bilingual lead management for small and medium service businesses — real estate agencies,
marketing companies, consultancies and training centres.

Teams capture enquiries, assign them to reps, schedule follow-ups, log every interaction and
move opportunities through a shared pipeline: **New → Contacted → Qualified → Proposal → Won → Lost**.

---

## Status

**Phase 1 — complete.** Auth, the full data model, the leads table with search/filter/sort, the
lead detail view with activity timeline and follow-ups, and a seeded demo workspace.

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Setup · auth · data model · leads table · lead detail · seed data | ✅ Done |
| 2 | Drag-and-drop pipeline board · dashboard with charts | Planned |
| 3 | EN/AR localisation with full RTL | Planned |
| 4 | Follow-up management · polish · landing page | Planned |
| 5 | AI lead assistant (stretch) | Planned |

The data model already anticipates phases 2 and 3: `Lead.boardPosition` exists for board ordering,
and `PipelineStage` carries both `name` and `nameAr` so Arabic labels need no migration.

---

## Stack

Every piece has a genuine free tier. **Total running cost: $0.**

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React 19 · TypeScript · Vite 7 | — |
| Styling | Tailwind CSS v4 · shadcn/ui · lucide-react | Tokens in one file; no hard-coded colours |
| Data fetching | TanStack Query v5 | Cache keys centralised in `client/src/lib/query-client.ts` |
| Forms | React Hook Form · Zod 4 | The **same Zod schemas** validate on both client and server |
| Routing | React Router v7 | — |
| Backend | Node 22 · Express 5 · TypeScript | `createApp()` factory — host-agnostic |
| ORM | Prisma 6 | — |
| Database | **Neon** serverless Postgres | Free tier: 0.5 GB, no credit card |
| Auth | **Self-hosted JWT** — scrypt + httpOnly cookies | No vendor, no MAU cap, nothing to bill |
| Hosting | **Vercel Hobby** — SPA + Express as one serverless function | Free; same-origin cookies |

### Why these choices

**Same-origin, not split-origin.** The client and API share one origin in every environment (Vite
proxies `/api` in development; Vercel routes it in production). The auth cookie is therefore a
first-party `SameSite=Lax` cookie — no CORS, and none of the third-party-cookie breakage that
Safari and Brave inflict on a `SameSite=None` cross-origin setup.

**scrypt, not argon2 or bcrypt.** scrypt is memory-hard (bcrypt is not) and ships inside Node's
standard library, so there is no native addon that could fail to load on a serverless host. OWASP
parameters `N=2^16, r=8, p=2`. See `server/src/lib/password.ts`.

**Stages as rows, not an enum.** `PipelineStage` is a table so a tenant can rename, recolour and
reorder its board without a migration, and so Arabic labels live beside English ones.

---

## Security model

- **Multi-tenancy.** Every tenant-owned row carries `organizationId`, and every service function
  takes an `Actor` and scopes its query by that id. Another tenant's record returns **404, not 403** —
  the API never confirms that a record it will not show you exists.
- **Sessions.** A 15-minute access JWT plus a 30-day refresh JWT, both in `httpOnly; SameSite=Lax;
  Secure` cookies. The refresh cookie is scoped to `/api/auth`, so it is never sent with ordinary
  API traffic.
- **Refresh rotation with reuse detection.** Using a refresh token revokes it and issues a
  replacement. Presenting an already-revoked token means the cookie leaked, so **every** session for
  that user is killed.
- **Revocable sessions.** Refresh tokens are rows storing a SHA-256 digest — a dump of that table
  hands an attacker nothing usable. Deactivating a member or changing a password revokes live
  sessions immediately.
- **Fresh authorisation per request.** `requireAuth` re-reads the user row rather than trusting the
  token's claims, so a role change or deactivation takes effect at once.
- **Timing-safe login.** Unknown email, wrong password and disabled account return the same error in
  roughly the same time, so the endpoint cannot be used to enumerate accounts.
- **Input validation.** Zod parses and *replaces* every request body, query and param, so unknown
  keys can never reach a Prisma write.
- **Rate limiting.** Login is limited per IP+email, signup per IP, everything else globally.
- Helmet security headers, a 256 kB body cap, and no stack traces in production responses.

---

## Local development

### Prerequisites

- **Node 20+** (this repo pins 22 via `.nvmrc` — `nvm use`)
- A free Neon Postgres project

### 1. Install

```bash
nvm use          # or: nvm install 22
npm install
```

### 2. Create a free Neon database

1. Sign up at <https://neon.tech> — free tier, no credit card.
2. Create a project with these settings:

   | Setting | Value |
   | --- | --- |
   | Cloud provider | AWS |
   | Region | **Europe (Frankfurt) `eu-central-1`** |
   | Postgres version | 17 (newest offered) |
   | Database name | `neondb` (the default) |
   | Add-ons (Neon Auth, Data API) | **None** — this app brings its own auth and talks to Postgres via Prisma |

   The region is not arbitrary: `vercel.json` pins the serverless functions to `fra1`, so the API
   and the database sit in the same region. Each request makes several Prisma round trips, and that
   is the hop that decides how fast the app feels — the CDN already handles viewer proximity.

3. From **Connection string**, copy **both** forms:
   - the **pooled** string (host contains `-pooler`) → `DATABASE_URL`
   - the **direct** string (no `-pooler`) → `DIRECT_URL`

### 3. Configure

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` and `DIRECT_URL`, then generate two different secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 4. Create the schema and seed

```bash
npm run db:migrate     # applies migrations
npm run db:seed        # ~62 leads with full activity history
```

### 5. Run

```bash
npm run dev            # API on :4000, web on :5173
```

Open <http://localhost:5173> and sign in with:

```
demo@leadpilot.app / DemoPass2026
```

### Useful scripts

| Command | Does |
| --- | --- |
| `npm run dev` | API + web with hot reload |
| `npm run build` | Production build of both |
| `npm run typecheck` | Typecheck every workspace |
| `npm run db:studio` | Prisma Studio — browse the data |
| `npm run db:reset` | Drop, re-migrate and re-seed |

---

## Product rules worth knowing

**One currency per workspace.** `estimatedValue` is never mixed: a lead inherits
`Organization.defaultCurrency` and the API ignores any `currency` a client sends. The pipeline
aggregates sum these figures directly, so allowing a per-lead currency made "total pipeline value"
arithmetic between different units, rendered in one of them.

**Archiving, not deleting.** `DELETE /api/leads/:id` sets `archivedAt` rather than removing the
row. An archived lead leaves every list and every total, but its activity trail and follow-ups
survive, and `POST /api/leads/:id/restore` puts it back. Archived leads stay **readable** by id —
that is where the restore action lives — but nothing new can be appended to them. The Archived
filter in the leads toolbar is how you find them.

**Who can do what.**

| Action | OWNER | ADMIN | MEMBER |
| --- | :-: | :-: | :-: |
| Read any lead in the workspace | ✅ | ✅ | ✅ |
| Add notes / log calls on any lead | ✅ | ✅ | ✅ |
| Edit a lead | ✅ | ✅ | own or created |
| Archive / restore a lead | ✅ | ✅ | ❌ |
| Edit or delete a note | any | any | own only |
| Edit a system audit entry | ❌ | ❌ | ❌ |
| Manage team members | ✅ | ✅ | ❌ |

System activity entries are immutable for everyone — the audit trail is the record of what
happened, so nobody rewrites it.

---

## Errors and debugging

Nothing is hidden behind a generic message. Every API error response carries:

```jsonc
{
  "error": {
    "code": "DATABASE_UNAVAILABLE",   // stable, machine-readable
    "message": "Cannot reach the database…",
    "requestId": "9630ce5c-6b9d-4e42…", // matches a line in the server log
    "debug": {                          // development only, by default
      "name": "PrismaClientInitializationError",
      "detail": "Can't reach database server at …",
      "stack": ["…"]
    }
  }
}
```

- `requestId` is generated by the **first** middleware in the stack, so even a request
  rejected by CORS before anything else runs is traceable. It is also returned as the
  `x-request-id` header, and accepted as one if your proxy already sets it.
- `debug` (real error name, message and stack) is included in development, and echoed to the
  browser console by the client's fetch wrapper. In production it is omitted — a public stack
  trace is information disclosure. Set `EXPOSE_ERROR_DETAILS=true` to include it anyway, which
  is reasonable on a portfolio demo only you are debugging.
- Every 5xx is logged server-side with a full stack regardless.

### CORS in development

Production honours `CORS_ORIGINS` and nothing else. Development additionally accepts **any**
loopback (`localhost`, `127.0.0.1`) or private-LAN (`10.x`, `192.168.x`, `172.16–31.x`) origin on
**any port**, because the exact origin is not knowable ahead of time: Vite moves to `5174` when
`5173` is taken, `localhost` and `127.0.0.1` are different origins to a browser, and testing the
responsive layout on a phone uses the machine's LAN IP.

A rejected origin returns a **403 naming the origin**, not an opaque 500.

---

## Deploying to Vercel (free)

The repo is configured for a **single** Vercel project serving both the SPA and the API.

1. Push to GitHub, then **Add New → Project** on Vercel and import the repo.
2. Leave the build settings alone — `vercel.json` supplies them.
3. Add these environment variables (Production **and** Preview):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon **pooled** string |
   | `DIRECT_URL` | Neon **direct** string |
   | `JWT_ACCESS_SECRET` | 48 random bytes |
   | `JWT_REFRESH_SECRET` | 48 different random bytes |
   | `NODE_ENV` | `production` |
   | `COOKIE_SECURE` | `true` |

   `vercel.json` already pins functions to `fra1` (Frankfurt) to match the Neon region, so there is
   nothing to change under Settings → Functions.

4. Deploy, then apply the schema to the production database once:

   ```bash
   DIRECT_URL="<neon direct string>" npm run db:deploy
   npm run db:seed        # optional — seeds the demo workspace
   ```

`/api/health` returns database connectivity and latency, which is the quickest way to confirm a
deployment is wired up correctly.

---

## Architecture

```
LeadPilot/
├── shared/          @leadpilot/shared — Zod schemas, enums and DTO types
│   └── src/         imported by BOTH client and server: one definition of a lead
├── server/          Express 5 API
│   ├── prisma/      schema + deterministic seed
│   └── src/
│       ├── app.ts       createApp() — no host-specific code
│       ├── lib/         password, tokens, cookies, serializers, activity log
│       ├── middleware/  auth, validation, rate limits, error handler
│       └── modules/     auth · leads · activities · follow-ups · team · stages
├── client/          React SPA
│   └── src/
│       ├── components/  ui (shadcn) · layout · common
│       ├── features/    auth · leads   (co-located API hooks + components)
│       ├── lib/         api client, query keys, formatting, labels
│       └── pages/       route-level screens
├── api/index.js     Vercel serverless entry — wraps the same Express app
└── vercel.json      build, routing and cache headers
```

**Why a shared package.** A lead's shape is defined once, in Zod. The server derives its validation
from it and the client derives its form types from it, so a field that changes shape breaks the
build rather than production.

**Portability.** `server/src/app.ts` exports `createApp()` and knows nothing about Vercel.
`server/src/index.ts` listens on a port for a classic host; `api/index.js` wraps the same app as a
serverless function. Moving to Render, Fly or a VPS is a config change, not a rewrite.

### Data model

| Model | Notes |
| --- | --- |
| `Organization` | The tenant. Owns everything below it. |
| `User` | `OWNER` / `ADMIN` / `MEMBER`. Members edit leads they own or created; only owners and admins archive. |
| `RefreshToken` | One row per session — what makes a JWT revocable. |
| `PipelineStage` | Per-tenant stage rows with colour, order, `name`, `nameAr`. |
| `Lead` | The core record, plus denormalised `nextFollowUpAt` / `lastActivityAt` for sorting. Soft-deleted via `archivedAt`. |
| `Activity` | Append-only timeline. System entries store structured `metadata`, not English strings. |
| `FollowUp` | Scheduled task with channel, due date and status. |

`Lead.nextFollowUpAt` and `Lead.lastActivityAt` are denormalised so the leads table can sort and
filter on them without a correlated subquery per row. They are maintained in exactly one place —
`server/src/lib/activity-log.ts`.

---

## API

All routes are under `/api` and all except the first three require authentication.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/auth/signup` | Create an organisation and its owner |
| `POST` | `/auth/login` | Sign in |
| `POST` | `/auth/refresh` | Rotate the session |
| `POST` | `/auth/logout` | Revoke this session |
| `GET`/`PATCH` | `/auth/me` | Current user |
| `POST` | `/auth/change-password` | Revokes all sessions |
| `GET` | `/stages` | The organisation's pipeline stages |
| `GET` | `/team` · `PATCH /team/:id` | Members (edit is owner/admin only) |
| `GET` | `/leads` | List — search, filter, sort, paginate |
| `GET` | `/leads/stats` | Aggregates over the *filtered* set |
| `POST` | `/leads` · `GET`/`PATCH`/`DELETE` `/leads/:id` | CRUD |
| `POST` | `/leads/:id/stage` · `/leads/:id/assign` | Audited stage move and reassignment |
| `GET`/`POST` | `/leads/:id/activities` | Timeline |
| `PATCH`/`DELETE` | `/activities/:id` | Edit or remove your own note |
| `GET`/`POST` | `/leads/:id/follow-ups` | Follow-ups for a lead |
| `GET` | `/follow-ups` | Organisation-wide task list |
| `POST` | `/follow-ups/:id/complete` · `/cancel` | Complete or cancel |

---

## Demo data

`npm run db:seed` builds a workspace for **Meridian Property Group**, a Gulf real-estate agency:
6 team members, 62 leads weighted into a realistic funnel shape, each with the activity history
that would have got it to its current stage, plus open and completed follow-ups — about one in six
open leads is deliberately overdue, so the urgency states have something to show.

A second tenant, **Northwind Consulting**, is seeded specifically so cross-organisation isolation
can be demonstrated: sign in as `owner@northwind.test` (same password) and Meridian's 62 leads are
completely invisible.

The seed uses a fixed PRNG, so re-running it produces identical data.

# LeadPilot

**Live demo → https://leadpilot-ih18.vercel.app**

Click **Start a demo** on the sign-in screen. No credentials needed.

Each visitor gets their **own private workspace** — a full clone of the demo template with 96
leads and a year of activity history. Change anything: drag deals across the pipeline board,
rename leads, archive them, watch the dashboard figures move. Nobody else sees it, and the next
visitor still starts from a pristine copy. Sandboxes are removed automatically after 24 hours.

Switch the language and the theme from the account menu in the sidebar, or from the top of the
sign-in screen. Arabic mirrors the entire layout, not just the words.

Nobody can sign into the template itself, so the master copy can never be edited.

Bilingual lead management for small and medium service businesses — real estate agencies,
marketing companies, consultancies and training centres.

Teams capture enquiries, assign them to reps, schedule follow-ups, log every interaction and
move opportunities through a shared pipeline: **New → Contacted → Qualified → Proposal → Won → Lost**.

---

## Status

**Phases 1 to 3 — complete.** Auth, the full data model, the leads table with bulk actions, the
lead detail view with activity timeline and follow-ups, a drag-and-drop pipeline board, a business
dashboard built on real aggregates, a public landing page, and the whole product in English or
Arabic with a mirrored right-to-left layout and a light/dark theme.

| Phase | Scope                                                                     | State   |
| ----- | ------------------------------------------------------------------------- | ------- |
| 1     | Setup · auth · data model · leads table · lead detail · seed data         | ✅ Done |
| 2     | Drag-and-drop pipeline board · dashboard with charts                      | ✅ Done |
| 3     | Landing page · EN/AR with full RTL · light and dark themes · bulk actions | ✅ Done |
| 4     | Follow-up management · polish                                             | Planned |
| 5     | AI lead assistant (stretch)                                               | Planned |

---

## Stack

Every piece has a genuine free tier. **Total running cost: $0.**

| Layer         | Choice                                                      | Why                                                         |
| ------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| Frontend      | React 19 · TypeScript · Vite 7                              | —                                                           |
| Styling       | Tailwind CSS v4 · shadcn/ui · lucide-react                  | Tokens in one file; no hard-coded colours                   |
| Data fetching | TanStack Query v5                                           | Cache keys centralised in `client/src/lib/query-client.ts`  |
| Forms         | React Hook Form · Zod 4                                     | The **same Zod schemas** validate on both client and server |
| Routing       | React Router v7                                             | —                                                           |
| i18n          | ~60 lines over `Intl` — no library                          | Keys, params and plurals are checked by the compiler        |
| Charts        | Recharts 3                                                  | Axes mirrored explicitly; it has no `dir` support           |
| Backend       | Node 22 · Express 5 · TypeScript                            | `createApp()` factory — host-agnostic                       |
| ORM           | Prisma 6                                                    | —                                                           |
| Database      | **Neon** serverless Postgres                                | Free tier: 0.5 GB, no credit card                           |
| Auth          | **Self-hosted JWT** — scrypt + httpOnly cookies             | No vendor, no MAU cap, nothing to bill                      |
| Hosting       | **Vercel Hobby** — SPA + Express as one serverless function | Free; same-origin cookies                                   |

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
- **Input validation.** Zod parses and _replaces_ every request body, query and param, so unknown
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

   | Setting                       | Value                                                                    |
   | ----------------------------- | ------------------------------------------------------------------------ |
   | Cloud provider                | AWS                                                                      |
   | Region                        | **Europe (Frankfurt) `eu-central-1`**                                    |
   | Postgres version              | 17 (newest offered)                                                      |
   | Database name                 | `neondb` (the default)                                                   |
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
npm run db:seed        # ~96 leads with a year of activity history
```

### 5. Run

```bash
npm run dev            # API on :4000, web on :5173
```

Open <http://localhost:5173> and click **Start a demo** — that clones the seeded template into a
working workspace with all 96 leads, exactly as a visitor gets. The sandbox and your session both
persist, so this is a perfectly good way to develop against realistic data.

Nobody can sign into the template directly, in any environment, so there is no back door to keep
track of. If you want a _stable_ account for testing sign-in itself, the seed also creates a second
ordinary workspace:

```
owner@northwind.test / DemoPass2026
```

It holds 6 leads and exists mainly to prove tenant isolation — sign in there and none of the
template's 96 leads are reachable.

### Useful scripts

| Command                | Does                             |
| ---------------------- | -------------------------------- |
| `npm run dev`          | API + web with hot reload        |
| `npm run build`        | Production build of both         |
| `npm run typecheck`    | Typecheck every workspace        |
| `npm run format`       | Format with Prettier             |
| `npm run format:check` | Verify formatting, write nothing |
| `npm run db:studio`    | Prisma Studio — browse the data  |
| `npm run db:reset`     | Drop, re-migrate and re-seed     |

---

## Formatting

`.prettierrc` pins the house style, and Prettier is a pinned dependency rather than whatever `npx`
resolves that day — the point is that two machines produce the same bytes. `printWidth` is 100
because that is where the code already sat: before the config existed, 99% of lines were under 100
characters, so adopting it was a formality rather than a reformat.

`.prettierignore` covers build output plus three things Prettier should not own: `package-lock.json`
and `server/prisma/migrations/` are written by their own tools, and `client/src/components/ui/` is
generated by the shadcn CLI, where reformatting only makes the next `shadcn add` a noisy diff.

`prettier-plugin-tailwindcss` sorts class names into Tailwind's canonical order, so nobody has to
argue about where `hover:` goes. Two options matter here: Tailwind v4 keeps its theme in CSS rather
than a JS config, so the plugin is pointed at `client/src/index.css` via `tailwindStylesheet` — get
that path wrong and it silently falls back to stock ordering — and `tailwindFunctions: ["cn", "cva"]`
because most classes in this codebase live inside `cn()` calls, which the plugin would otherwise
skip.

Sorting is safe with `tailwind-merge`, which resolves conflicts last-wins: the plugin reorders
_within_ each string but never moves a class between arguments, so the `cn('base', condition &&
'override')` pattern still overrides. Adopting it changed 14 files and zero computed styles.

There is exactly one `// prettier-ignore` in the codebase, on `DEFAULT_STAGE_PRESETS`. Six stages on
six lines read as the table they are; formatted normally it becomes 54 lines and you can no longer
scan the colours and probabilities down a column. Reach for it that rarely.

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

| Action                            | OWNER | ADMIN |     MEMBER     |
| --------------------------------- | :---: | :---: | :------------: |
| Read any lead in the workspace    |  ✅   |  ✅   |       ✅       |
| Add notes / log calls on any lead |  ✅   |  ✅   |       ✅       |
| Edit a lead                       |  ✅   |  ✅   | own or created |
| Archive / restore a lead          |  ✅   |  ✅   |       ❌       |
| Edit or delete a note             |  any  |  any  |    own only    |
| Edit a system audit entry         |  ❌   |  ❌   |       ❌       |
| Manage team members               |  ✅   |  ✅   |       ❌       |

System activity entries are immutable for everyone — the audit trail is the record of what
happened, so nobody rewrites it.

---

## How the demo works

A public demo has a data problem: the first visitor to rename a lead ruins it for everyone after
them. Read-only would solve that, but it also removes the only interesting part of a CRM.

So the seeded workspace is a **template** that nobody signs into. `POST /api/auth/demo` clones it —
organisation, users, stages, leads, activities and follow-ups — into a throwaway organisation with
fresh ids, and signs the visitor into that copy. Isolation is not new code: every tenant-owned row
already carries `organizationId` and every query is already scoped by it, so the multi-tenancy that
separates two paying customers is the same mechanism that separates two demo visitors.

Two implementation details are worth knowing:

- The clone is a handful of set-based `INSERT … SELECT` statements rather than ~530 round trips,
  so a visitor waits a few hundred milliseconds rather than several seconds.
- It runs as raw SQL specifically to bypass Prisma's `@updatedAt`, which would otherwise stamp
  every cloned row with "now" and flatten the deliberately aged demo timeline.

Ids are derived rather than mapped: `'d' || substr(md5(<old id> || <token>), 1, 24)` is stable
within one clone, so a child row computes its parent's new id without a lookup table. Postgres
returns `NULL` for `NULL || x`, so nullable foreign keys — an unassigned lead — carry through
correctly for free.

Sandboxes expire after 24 hours. A Vercel cron calls `/api/internal/reap-demo-sandboxes` daily,
and starting a demo also reaps opportunistically so the table cannot grow unbounded between runs.

---

## The pipeline board

Cards carry a manual rank (`Lead.boardPosition`) within their stage, and a drop sends the server a
stage plus an **anchor** — "put this card immediately below that one" — rather than an index. An
index would be wrong the moment a column is only partially loaded: position 5 of the 40 cards on
screen is not position 5 of the 300 in the stage. An anchor means the same thing either way, and
survives someone else reordering the column mid-drag.

The server then renumbers the whole destination column in one set-based `UPDATE`. The alternative —
squeezing the moved card into the numeric gap between its new neighbours — is O(1) but eventually
runs out of integers between two adjacent positions and needs a rebalancing pass anyway. That
`UPDATE` is deliberately raw SQL: going through Prisma would fire `@updatedAt` on every card that
merely shifted up by one, and scramble the leads table's "Last updated" sort every time anyone
touched the board.

**Paging is a request parameter, not client state.** "Show more" raises a single
`limit` for the board and refetches, rather than appending an extra page into the cache. The first
version did append, and it was subtly broken: the next refresh of the board — after a drag, on
window focus, on any invalidation — refetched at the base page size and silently threw the extra
cards away. Making depth part of the request means a refetch returns exactly what the user was
already looking at. Past 200 cards in one column the board stops offering more and links to the
leads table, which is the right tool for that many records.

Three other decisions worth naming:

- **Cards a rep cannot move do not pretend otherwise.** Every lead in a list response carries
  `canEdit`, computed server-side from the same rule the API enforces, so a card someone lacks
  rights to shows a lock instead of a drag handle. Discovering a permission by dragging a card and
  watching it snap back is a worse way to learn it.
- **Mouse and touch get separate sensors.** A few pixels of travel is the right threshold for a
  mouse; applied to a finger it hijacks every attempt to _scroll_ the column. Touch uses a short
  press-and-hold instead — swipe to scroll, hold to pick up.
- **Dragging is never the only way.** Each card has a "move to stage" menu, and the drag handle is
  a real focusable control that lifts with Space and moves with the arrow keys. Dropping into a
  Lost stage asks for a reason first, because nobody ever goes back to add it later.

---

## Bulk actions on the leads table

Tick rows in the leads table and a floating bar offers **move to stage**, **assign to** and
**archive** — plus **restore** while the Archived filter is on, which is the useful inverse there.

**"Delete" is archive.** `DELETE /api/leads/:id` has always set `archivedAt` rather than removing
the row, so bulk delete and bulk archive would be the same operation under two names. Only one is
offered. A true permanent delete would have to destroy the activity trail with it, which is
exactly what archiving exists to avoid.

**Four statements, not four hundred.** The singular endpoints are a read, a write and an activity
entry each; looping eighty of them would be several hundred round trips inside one transaction.
Each bulk endpoint is instead a bounded handful regardless of selection size — one read to load
and authorise, one `updateMany`, one batched activity write — so `recordActivities` exists
alongside `recordActivity` and keeps the `lastActivityAt` invariant in one place.

**Closing a selection as Lost asks why.** The board and the detail view both prompt for a reason
before a deal is marked lost, on the grounds that nobody goes back to add it later. Bulk does the
same, once, for the whole selection — otherwise the fastest way to lose a hundred deals would also
be the only one that recorded nothing about them.

**Partial success is normal, and the reasons are different.** A selection is made against whatever
the table is showing, so it can contain leads the caller may not touch, or ones already in the
requested state. The result separates them:

```jsonc
{ "updated": 12, "unchanged": 2, "notPermitted": 1 }
```

Reporting a single `skipped` count was worse than useless — the UI had to guess why, and it told
an owner they could "only change leads assigned to you", which is not true of an owner. Only
`notPermitted` is worth a line under the toast.

**Selection is page-scoped and permission-scoped.** It clears when the filters or the page change,
because carrying ids across pages ends with you archiving thirty leads having looked at ten. Rows
a rep cannot edit are not selectable at all, with the reason on the checkbox, rather than being
selectable and then quietly dropped server-side.

---

## The dashboard

Every figure is aggregated in Postgres — nine queries in two batches — rather than by loading leads
into Node and reducing over them. An aggregate the API can only produce by fetching every row is
one that quietly stops working at the size where anyone would care about it.

Two scopes share the screen, and each panel says which one it is on:

- **Windowed** — leads created, deals closed, conversion, the trend chart, source attribution.
  These honour the range selector and carry a comparison against the equivalent window before it.
- **Right now** — open pipeline, the forecast, stage occupancy, follow-up workload. A pipeline is
  a current state; slicing it by "the last 30 days" answers a question nobody asked, because a deal
  that has sat in Proposal for six weeks is still in Proposal today.

**Expected revenue** is Σ (open lead value × its stage's win probability). Those probabilities are
a column on `PipelineStage`, not a constant in a chart component — which is what makes the forecast
a real model a workspace could tune against its own history, rather than a magic number baked into
the UI.

A few smaller judgements about not overstating what the data says: a change from a window with
zero in it is reported as "no prior data" rather than as infinite growth; a conversion rate over
zero closed deals is `—`, not `0%`; and the source tooltip gives the denominator, because "100%"
off one closed deal is not the claim "100%" off twenty is.

---

## Language and direction

The whole product runs in English or Arabic, and Arabic gets a mirrored layout rather than
translated strings in a left-to-right frame. Pick a language from the account menu, or from the
top of the sign-in screen — which is the one place someone who cannot read the current language
needs the control to be.

### No i18n library

There is a `lib/i18n` directory instead, and that is a deliberate trade. What this app needs from
a library is a lookup, `{placeholder}` interpolation and correct plural selection; the platform
already provides the third through `Intl.PluralRules`. What the sixty lines in `translate.ts` buy
in exchange is the thing a runtime library cannot offer: **the compiler checks the keys.**

```ts
t('leads.title'); // fine
t('leads.titel'); // ✗ not a key
t('leads.description'); // ✗ needs { organization }
t('leads.description', { org: 'Acme' }); // ✗ wrong placeholder name
t('due.overdue'); // ✗ a plural family needs { count }
```

`en.ts` is the source of truth for the key list, and `ar.ts` is typed as `Dictionary`, so deleting
or renaming an English string breaks the build until Arabic catches up. A half-translated
dictionary is the normal failure mode of i18n work and it is invisible until a user reports it;
here it cannot be committed.

### Plurals

Arabic has six plural categories where English has two, so `t()` delegates the choice to
`Intl.PluralRules` rather than testing `count === 1`. "3 days" and "11 days" are genuinely
different words:

| count | category | Arabic          |
| ----- | -------- | --------------- |
| 1     | one      | يوم واحد        |
| 2     | two      | يومان           |
| 3–10  | few      | `{count}` أيام  |
| 11–99 | many     | `{count}` يومًا |
| 100+  | other    | `{count}` يوم   |

A locale may add forms to a key English keeps singular — `validation.tooLong` has one English
string and five Arabic ones — which is why the dictionary type allows plural suffixes on any key,
not only on families English happens to declare.

### Grammar, not just vocabulary

Two problems only appear once the words are right:

- **Gender agreement.** `{field} مطلوب` cannot work, because `الاسم` is masculine and
  `الخدمة المطلوبة` is feminine, and one adjective cannot agree with both. The Arabic uses an
  impersonal construction — `يجب إدخال {field}` — that takes the field as an object, so gender
  never enters into it. The length rules do the same trick with `طول` ("length") as the subject.
- **Word order.** "Layla moved the lead from New to Won" puts the actor first; Arabic puts the
  verb first. Concatenating `<strong>{actor}</strong>` with " moved the lead from " produces
  nonsense in Arabic no matter how good the words are. `useRichT` interpolates React nodes into a
  whole translated sentence instead, so each language places the pieces where it wants them.

### Validation messages

The shared Zod schemas guard the API _and_ the browser form, so they cannot hard-code English
prose. They emit a **message token** — a sentinel-prefixed payload naming a key and its params —
and each side renders it in the language it speaks: the server resolves every token to English
before responding, so the public API contract stays plain English for any consumer, while the
browser resolves the same token against the active locale. Since the form validates client-side
before it ever submits, what a user actually reads is always in their own language.

### Numbers, dates and currency

Every formatter is built once per locale in `lib/format.ts` and reached through `useFormat()` —
`Intl` constructors are expensive enough that building one per table cell is a real cost.

Arabic uses **Latin digits** (`ar-u-nu-latn`). Arabic-Indic numerals are correct for prose, but
Gulf business software — invoices, banking, CRMs — overwhelmingly uses Latin digits, and mixing
them with Latin currency codes and `tabular-nums` column alignment reads as a bug rather than a
nicety. It is one constant in `locale-provider.tsx` if a workspace disagrees.

Stage names come from the database (`PipelineStage.name` / `nameAr`), not the dictionary, because
a workspace can rename "Proposal" to "Quote sent" — they are tenant data, not UI copy.

### Arabic is not in the main bundle

English ships with the app because it is the fallback and most visitors never leave it. Arabic —
its dictionary and the `date-fns` locale, about 40 kB together — is a dynamic import, and the
IBM Plex Sans Arabic webfont is requested on the same condition. An English-speaking visitor
downloads neither.

The provider holds rendering until the requested language is in hand rather than painting a frame
of English first: for someone whose stored language is Arabic, a brief spinner is a better answer
than the wrong language flashing past. Returning Arabic readers do not wait on React for the font
either — the bootstrap script in `index.html` already knows the answer and starts that download in
the document head.

### Right to left

`dir` and `lang` are set on `<html>`, and an inline script in `index.html` applies both before the
first paint. Without it an Arabic reader watches the entire layout jump across the screen for one
frame, which is a much louder flash than a colour change.

- **Logical properties everywhere.** `ms-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `border-s`
  — no physical `ml-`/`pr-`/`left-` survives in application code, including the shadcn primitives.
- **Radix gets its own direction context.** It reads direction from a provider, not from the DOM,
  so without `DirectionProvider` a select would still open the wrong way and arrow keys inside a
  menu would move backwards.
- **Icons flip only when they mean a direction.** `.icon-directional` mirrors a chevron that points
  into a link; a trend arrow meaning "up" is left alone, because up is up in both directions.
- **Charts are mirrored explicitly.** Recharts lays out SVG by absolute coordinate and knows
  nothing about `dir`, so `useChartDirection()` reverses the category axis, moves the value axis to
  the reading-end side, and flips the bar corner radii. Left alone, an Arabic chart reads backwards
  against its own labels.
- **Two fonts, one stack.** Inter carries no Arabic, so the browser falls through per glyph to IBM
  Plex Sans Arabic. Both are grotesques of similar proportion, so an Arabic label next to an AED
  figure reads as one typeface.

---

## Theming

Light and dark are the same design token set with two values each, declared once in `index.css`
and consumed only through utility classes — `bg-background`, `text-muted-foreground`. Nothing in
the app hard-codes a hex, which is what makes a theme (or a client's brand colours) a one-file
change.

The choice is stored per device and applied before the first paint, alongside the language.
`system` stays live: it tracks the OS preference rather than sampling it once at load. The browser
chrome follows too — `<meta name="theme-color">` is media-scoped for the system preference and
overwritten when someone picks a theme explicitly.

Charts are the one place the tokens cannot reach: Recharts writes `fill` and `stroke` as SVG
presentation attributes, where `var(--token)` is not valid. Structural elements use
`stroke="currentColor"` so the token resolves through CSS, and the four data-series colours are
fixed hexes chosen to hold up on both backgrounds.
The endpoint is closed unless `CRON_SECRET` is set, compared in constant time — a misconfigured
deploy fails closed, not open.

---

## Environments

|             | Neon branch  | Used by                                    |
| ----------- | ------------ | ------------------------------------------ |
| Production  | `production` | The live deployment                        |
| Development | `dev`        | Local `npm run dev`, `db:reset`, `db:seed` |

Local development points at a separate branch on purpose: `npm run db:reset` drops and reseeds,
and that must never be one mistyped command away from wiping the live demo. `neon checkout dev`
pins the branch for this working copy.

---

## If this shipped commercially

The engineering is production-shaped; these are the operational gaps that a paying deployment
would need to close, listed so nothing is hidden:

- **Hosting plan.** Vercel's Hobby tier is licensed for non-commercial use. A commercial
  deployment needs Pro, or the customer's own account.
- **Rate limiting** is per-instance and resets on cold start, because serverless functions do not
  share memory. Real traffic wants a shared store (Upstash Redis has a free tier) behind the same
  `express-rate-limit` interface — a store swap, not a rewrite.
- **Account enumeration on signup.** Login is timing-equalised, but signup returns a distinct
  `409 EMAIL_TAKEN`. Closing it properly means an email-verification flow, which is the right
  moment to add transactional email.
- **Backups.** Neon's free tier keeps a short restore window. A paid plan extends point-in-time
  recovery.
- **Observability.** Every 5xx is logged with a request id and a full stack trace, but there is no
  aggregator. The error handler is the single place a Sentry hook would go.

---

## License

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE).
Copyright © 2026 Ibrahim.

**You may** read, run, study, modify and share LeadPilot for any noncommercial purpose — personal
study, hobby projects, evaluating my work, teaching, or use by a charity, school or public
institution.

**You may not** use it commercially. That right is reserved. If you want a commercial licence, open
an issue and ask.

### Why not MIT

MIT would let anyone take LeadPilot, rebrand it and sell it, irrevocably, and this is a product I
may want to sell. Leaving the repository with no licence at all would protect that, but it also
leaves everyone guessing: strictly, no licence means no permission to do anything, which is a
strange thing to say about code published specifically to be read.

PolyForm Noncommercial says exactly what is meant. It is a real licence drafted by lawyers rather
than a homemade "all rights reserved" paragraph, it is short and plain-English, and it grants the
reading, running and learning that a portfolio piece exists for while reserving the commercial
rights that a product needs.

---

## Errors and debugging

Nothing is hidden behind a generic message. Every API error response carries:

```jsonc
{
  "error": {
    "code": "DATABASE_UNAVAILABLE", // stable, machine-readable
    "message": "Cannot reach the database…",
    "requestId": "9630ce5c-6b9d-4e42…", // matches a line in the server log
    "debug": {
      // development only, by default
      "name": "PrismaClientInitializationError",
      "detail": "Can't reach database server at …",
      "stack": ["…"],
    },
  },
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

   | Variable             | Value                     |
   | -------------------- | ------------------------- |
   | `DATABASE_URL`       | Neon **pooled** string    |
   | `DIRECT_URL`         | Neon **direct** string    |
   | `JWT_ACCESS_SECRET`  | 48 random bytes           |
   | `JWT_REFRESH_SECRET` | 48 different random bytes |
   | `NODE_ENV`           | `production`              |
   | `COOKIE_SECURE`      | `true`                    |

   `vercel.json` already pins functions to `fra1` (Frankfurt) to match the Neon region, so there is
   nothing to change under Settings → Functions.

4. Deploy, then apply the schema to the production database once:

   ```bash
   DIRECT_URL="<neon direct string>" npm run db:deploy
   npm run db:seed        # optional — seeds the demo workspace
   ```

`/api/health` returns database connectivity and latency, which is the quickest way to confirm a
deployment is wired up correctly.

### How the deployment is wired

One Vercel project serves both halves. The SPA is a static build; every `/api/*` request is
rewritten to a single serverless function that wraps the same `createApp()` Express instance
`npm run dev` runs locally, so there is no host-specific code in the app itself.

Functions are pinned to `fra1` to sit beside the Neon database in Frankfurt — each request makes
several Prisma round trips, and that is the hop that decides how fast the app feels. Production
health checks report ~120 ms of database latency.

Because both halves share an origin, the auth cookie is a first-party `SameSite=Lax` cookie: no
CORS in production, and none of the third-party-cookie breakage a split origin would inherit.
Same-origin requests are allowed by comparing `Origin` against the forwarded host rather than an
allowlist, since every preview deployment gets its own hostname.

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
│       └── modules/     auth · leads · board · dashboard · activities · follow-ups · team · stages
├── client/          React SPA
│   └── src/
│       ├── components/  ui (shadcn) · layout · common
│       ├── features/    auth · leads · board · dashboard   (co-located API hooks + components)
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

| Model           | Notes                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Organization`  | The tenant. Owns everything below it. `isDemoTemplate` marks the demo master; `expiresAt` marks a throwaway sandbox.                                                |
| `User`          | `OWNER` / `ADMIN` / `MEMBER`. Members edit leads they own or created; only owners and admins archive.                                                               |
| `RefreshToken`  | One row per session — what makes a JWT revocable.                                                                                                                   |
| `PipelineStage` | Per-tenant stage rows with colour, order, `name`, `nameAr` and `winProbability` — the last drives the dashboard's revenue forecast.                                 |
| `Lead`          | The core record, plus denormalised `nextFollowUpAt` / `lastActivityAt` for sorting and `boardPosition` for manual rank on the board. Soft-deleted via `archivedAt`. |
| `Activity`      | Append-only timeline. System entries store structured `metadata`, not English strings.                                                                              |
| `FollowUp`      | Scheduled task with channel, due date and status.                                                                                                                   |

`Lead.nextFollowUpAt` and `Lead.lastActivityAt` are denormalised so the leads table can sort and
filter on them without a correlated subquery per row. They are maintained in exactly one place —
`server/src/lib/activity-log.ts`.

---

## API

All routes are under `/api` and all except the first three require authentication.

| Method           | Route                                          | Purpose                                                      |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `POST`           | `/auth/signup`                                 | Create an organisation and its owner                         |
| `POST`           | `/auth/demo`                                   | Clone the demo template into a private sandbox and sign in   |
| `POST`           | `/auth/login`                                  | Sign in                                                      |
| `POST`           | `/auth/refresh`                                | Rotate the session                                           |
| `POST`           | `/auth/logout`                                 | Revoke this session                                          |
| `GET`/`PATCH`    | `/auth/me`                                     | Current user; `PATCH` accepts `name` and `locale`            |
| `POST`           | `/auth/change-password`                        | Revokes all sessions                                         |
| `GET`            | `/stages`                                      | The organisation's pipeline stages                           |
| `GET`            | `/team` · `PATCH /team/:id`                    | Members (edit is owner/admin only)                           |
| `GET`            | `/leads`                                       | List — search, filter, sort, paginate                        |
| `GET`            | `/leads/stats`                                 | Aggregates over the _filtered_ set                           |
| `POST`           | `/leads` · `GET`/`PATCH`/`DELETE` `/leads/:id` | CRUD                                                         |
| `POST`           | `/leads/bulk/{archive,restore,stage,assign}`   | Bulk actions; returns `{ updated, unchanged, notPermitted }` |
| `POST`           | `/leads/:id/stage` · `/leads/:id/assign`       | Audited stage move and reassignment                          |
| `POST`           | `/leads/:id/board-position`                    | Drag-and-drop: stage **and** rank within the column          |
| `GET`            | `/board?limit=`                                | Every stage with its cards, plus per-stage totals and value  |
| `GET`            | `/dashboard?range=30d\|90d\|12m`               | Every dashboard figure, aggregated in Postgres               |
| `GET`/`POST`     | `/leads/:id/activities`                        | Timeline                                                     |
| `PATCH`/`DELETE` | `/activities/:id`                              | Edit or remove your own note                                 |
| `GET`/`POST`     | `/leads/:id/follow-ups`                        | Follow-ups for a lead                                        |
| `GET`            | `/follow-ups`                                  | Organisation-wide task list                                  |
| `POST`           | `/follow-ups/:id/complete` · `/cancel`         | Complete or cancel                                           |

---

## Demo data

`npm run db:seed` builds a workspace for **Meridian Property Group**, a Gulf real-estate agency:
6 team members and 96 leads weighted into a realistic funnel shape, each with the activity history
that would have got it to its current stage, plus open and completed follow-ups — about one in six
open leads is deliberately overdue, so the urgency states have something to show.

The **timeline** matters as much as the funnel shape. Open leads are recent, because a lead still
sitting in New after three months is a data-quality problem rather than an enquiry; closed deals
stretch back a full year and outnumber them, which is what a CRM actually looks like after a year
of trading. Each closed deal is dated a plausible sales cycle after its own creation, so "average
days to close" is a real figure. Getting this wrong is visible: an earlier version bunched every
win into the last five months, and the dashboard's 12-month chart drew seven empty months followed
by a hockey stick — data that says "seeded last week" rather than "a working business".

A second tenant, **Northwind Consulting**, is seeded specifically so cross-organisation isolation
can be demonstrated: sign in as `owner@northwind.test` / `DemoPass2026` and the template's 96 leads
are completely invisible — every list, every board column, every chart, and a 404 on any direct id.

The seed uses a fixed PRNG, so re-running it produces identical data.

# Operation Help — remax DOORS

Internal operations workspace. Next.js 16 (App Router) + TypeScript + Tailwind v4,
reading live from the M1 SQL Server database through a whitelisted data gateway.

## Run it

```bash
npm run dev
```

Open http://localhost:4080. Scripts: `npm run build`, `npm run start`, `npm run typecheck`.

## Pages

| Route        | What it is                                                  |
| ------------ | ----------------------------------------------------------- |
| `/`          | Public landing — sign in with Microsoft                     |
| `/dashboard` | Open / unassigned / closed counts + latest non-conformances |
| `/ncr`       | Filterable NCR table (status, category, keyword)            |
| `/ncr/new`   | Add NCR wizard — writes a new NCR into M1                   |
| `/ncr/{id}`  | NCR detail: classification, people, text, attachments       |
| `/api-docs`  | API reference with copyable curl and live "Try it"          |

## Architecture

```
src/app/(app)          Signed-in routes; the group layout enforces the session
src/app/api            Route handlers (auth, ncr, health)
src/components/ui      Reusable primitives (Button, Card, Badge, Field, DataTable, StatCard…)
src/components/layout  AppShell, Sidebar, Topbar, MobileMenu, Breadcrumbs, CookieConsent
src/lib/db             Pool (client.ts), table registry (tables.ts), gateway (gateway.ts)
src/lib/repositories   Named read/write functions — the only DB callers
src/lib/auth           Entra ID flow + signed session cookie
src/lib/simpro         Simpro REST wrapper (optional)
```

### The DB rule

Pages and route handlers **never** touch SQL. They call repository functions
(`listNcrs`, `getNcr`, `countByStatus`, `listCategories`). Repositories call the
gateway (`readRows`, `countRows`, `insertRow`, `updateRow`), which:

- rejects any table not declared in `src/lib/db/tables.ts`;
- rejects any column not listed as `readable` / `writable` for that table;
- binds every value as a typed parameter — no string-built SQL anywhere.

Registered tables (all read-only today): `NonConformances`,
`NonConformanceCategories`, `NonConformanceCodes`, `NonConformanceCauses`.
To expose a new one, add a registry entry and write a repository for it.

M1's lookup tables are small (7–13 rows), so categories/codes/causes are fetched
whole and joined in memory — that keeps every query inside the single-table gateway.

### Writes

`qarNonConformanceID` has no IDENTITY or sequence. M1 allocates it from
`dbo.NextIDs` (one row per table, `xanTable` -> `xanNextID`), so
`insertRowWithAllocatedId` does the same: it reads that row under `UPDLOCK`,
inserts, and advances the counter in one transaction. Numbers issued by this
app and numbers issued inside M1 therefore cannot collide.

If the counter ever falls behind the table, the higher of the two wins, so a
stale counter self-heals rather than causing a duplicate. `peekNextId` reads
the next number without consuming it, which is what the wizard displays.

Registered writable tables: `NonConformances`, `Attachments`. Everything else
stays read-only.

### Attachments

M1 references attachments by path — of 61k rows in `dbo.Attachments`, none
populate `cmaBLOB`. The wizard follows that: the file is written to
`ATTACHMENT_DIR`, then an `Attachments` row points at it with
`cmaNonConformanceID` set. **`ATTACHMENT_DIR` must be somewhere M1 users can
also reach** (a mapped share), or M1 will show a link nobody can open.

### Simpro

`src/lib/simpro/client.ts` has the transport, auth and error handling done. Two
things await your details, both marked `TODO(simpro)`:

- `fetchSimproJob` — endpoint and field names for job prefill
- `createSimproTask` — which Simpro object represents a task in your account,
  plus `SIMPRO_ENGINEERING_STAFF_ID` / `SIMPRO_PROJECT_MANAGER_STAFF_ID`

## API

The app listens on **port 4080**; every endpoint is under `/api`. `/api-docs`
documents them and `/api` returns the same list as JSON.

Two ways to authenticate:

- `X-API-Key: <API_KEY>` (or `Authorization: Bearer <API_KEY>`) for scripts,
  M1, Power BI — API routes only, never the UI.
- A browser session, which is how the "Try it" buttons work.

`/api/health/db` and `/api/auth/*` are open; everything else requires one of
the two. `src/middleware.ts` enforces this — note it must live in `src/`,
because this project uses a `src` directory. At the project root it is silently
ignored.

## Configuration (`.env.local`)

```
DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD   # required
DB_PORT, DB_SCHEMA, DB_ENCRYPT, DB_TRUST_SERVER_CERT   # optional
AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET
AUTH_SECRET            # random 32+ chars, signs the session cookie
APP_BASE_URL           # http://localhost:4080 in dev
API_KEY                # long random string for programmatic callers
AUTH_DEV_BYPASS        # dev only: skip sign-in; ignored in production builds
SIMPRO_BASE_URL, SIMPRO_API_TOKEN          # optional
```

Connection status: http://localhost:4080/api/health/db

### Microsoft sign-in

Authorization-code flow with PKCE against Entra ID — the app never sees a
password. Register an app in Entra ID, add redirect URI
`http://localhost:4080/api/auth/callback` (and the production equivalent), then
fill the `AZURE_AD_*` values and set `AUTH_DEV_BYPASS=false`.

`middleware.ts` bounces requests with no session cookie; `requireSession()`
verifies the cookie signature server-side.

## Brand

Tokens in the `@theme` block of `src/app/globals.css`: red `#DC1C2E`, white,
graphite `#23272B`, light grey `#F3F5F7`. Use `bg-brand-red`, `bg-graphite`,
`border-line`, `text-ink-muted`, and `.brand-bar` for the three-stripe accent.
Red is reserved for actions and open/alert states; greys carry structure.

## Responsive

Below `md` the sidebar is replaced by a hamburger sheet (`MobileMenu`) carrying
the nav plus Refresh, Add NCR and Sign out. `PageHeader` actions are hidden on
small screens because the menu already carries them.

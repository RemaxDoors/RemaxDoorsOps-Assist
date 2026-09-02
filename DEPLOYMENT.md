# Going to production

Ordered by risk. Phase 1 items are blockers — the app must not be put in front
of staff until they are done. Later phases can follow once it is live.

Current state for reference: running `next dev` on one laptop, signed-in checks
bypassed, connected to **production M1** as `sa`, Simpro pointed at **QA**.

---

## Phase 1 — Blockers

### 1.1 Stop connecting as `sa`

The app currently has full administrative rights over the M1 server. A bug or a
compromised API key could drop tables.

```sql
CREATE LOGIN ops_assist_app WITH PASSWORD = '<strong password>';
USE M1_RP;
CREATE USER ops_assist_app FOR LOGIN ops_assist_app;

GRANT SELECT, INSERT, UPDATE ON dbo.NonConformances TO ops_assist_app;
GRANT SELECT, INSERT, UPDATE ON dbo.Attachments     TO ops_assist_app;
GRANT SELECT, UPDATE          ON dbo.NextIDs        TO ops_assist_app;
GRANT SELECT ON dbo.NonConformanceCategories TO ops_assist_app;
GRANT SELECT ON dbo.NonConformanceCodes      TO ops_assist_app;
GRANT SELECT ON dbo.NonConformanceCauses     TO ops_assist_app;
GRANT SELECT ON dbo.Jobs                     TO ops_assist_app;
GRANT SELECT ON dbo.Employees                TO ops_assist_app;
```

No DELETE anywhere: the app never deletes, so the login should not be able to.

Then set `DB_USER` / `DB_PASSWORD` and restart. Verify with `/api/health`.

### 1.2 Get a test M1 database

Every NCR raised while building went into **production M1**. There is currently
nowhere else to point it, so any future change is tested against live data.

Restore a recent `M1_RP` backup as `M1_TEST` on the same instance, and use that
for `.env.local` on development machines. Production config lives only on the
server.

### 1.3 Turn sign-in on

```
AUTH_DEV_BYPASS=false
```

With it `true`, anyone who can reach the port can read and write NCRs. Before
flipping it, register the app in Entra ID:

1. Entra admin centre → App registrations → New registration.
2. Redirect URI (Web): `https://<production host>/api/auth/callback`.
3. Certificates & secrets → New client secret. Note the expiry date.
4. Fill `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`.
5. Set `APP_BASE_URL` to the production URL.

Restrict who can sign in via the app registration's assignment settings, or the
app is open to everyone in the tenant.

### 1.4 Point attachments at a share

```
ATTACHMENT_DIR=\\fileserver\Quality\NCR Attachments
```

M1 stores this path verbatim and users open it from the ERP. While it points at
a local folder, every attachment is unopenable from any other machine.

The service account running the app needs write access to that share; M1 users
need read.

### 1.5 Switch Simpro to production

```
SIMPRO_BASE_URL=https://remaxdoors.simprosuite.com
SIMPRO_API_TOKEN=<production token>
SIMPRO_COMPANY_ID=<production company id>
```

Confirm the company id against `GET /api/v1.0/companies/` on the production
account — QA uses 4 (Melbourne), production may differ.

Also confirm `SIMPRO_JOB_URL_TEMPLATE` against a real production job URL. The
current value is a guess.

### 1.6 Run a production build, not the dev server

`next dev` is slower, leaks source, and dies with the terminal.

```bash
npm ci
npm run build
npm run start
```

Then run it as a Windows service so it survives reboots and crashes — NSSM or
`node-windows` both work:

```bash
nssm install OperationHelp "C:\Program Files\nodejs\node.exe" "node_modules\next\dist\bin\next" start -p 4080
nssm set OperationHelp AppDirectory C:\apps\operation-help
nssm set OperationHelp AppEnvironmentExtra NODE_ENV=production
```

### 1.7 Put it behind HTTPS

Sign-in cookies are only marked `Secure` when `NODE_ENV=production`, and an
Entra redirect URI should be `https`. Terminate TLS at IIS (with URL Rewrite as
a reverse proxy to `localhost:4080`) or another reverse proxy, and do not expose
port 4080 directly.

### 1.8 Rotate the secrets that have been on a laptop

`API_KEY` and `AUTH_SECRET` were generated during development and have sat in a
working directory. Generate fresh values for production:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Production `.env` should exist only on the server, readable only by the service
account.

---

## Phase 2 — Before wider rollout

### 2.1 Add the outstanding M1 column

See [m1/M1-Setup.md](m1/M1-Setup.md) — `uqarSimproTaskID` so Simpro tasks are
recorded against the NCR, plus the two Design Mode form changes.

### 2.2 Clean up the test data

Listed by ID in [TODO.md](TODO.md): NCRs and attachment rows in M1, and tasks,
job notes and attachment folders in Simpro QA.

### 2.3 Decide the Simpro attachment policy

Every NCR attachment is currently copied to the Simpro job as well as the
share. That is deliberate (photos are write-once evidence) but it doubles
storage and pushes shop-floor photos into a customer-facing system. Confirm
that is wanted before rollout.

### 2.4 Back up what the app writes

M1's own backup covers `NonConformances` and `Attachments` rows. The
**attachment files themselves** live on the share and need to be in the backup
set — the database only holds paths.

### 2.5 Move the repository

It currently sits under a personal GitHub account
(`22565725/RemaxDoorsOps-Assist`). Move it to the company account or an
organisation, so access does not depend on one person.

---

## Phase 3 — Operability

### 3.1 Logging

There is no logging beyond console output. At minimum, log every write to M1
(who, which NCR, when) — this app writes to a quality system and "who raised
this and when" is an audit question. `qarCreatedBy` records the signed-in user,
but failures leave no trace.

### 3.2 Monitoring

`/api/health` is built for this and needs no authentication. Point an uptime
monitor at it and alert on `ok: false`. It reports M1 and Simpro separately.

### 3.3 Error alerting

The error screen opens a pre-filled email for the user to send. Automatic
alerting needs an SMTP account for the app, or an error tracker (Sentry).

### 3.4 Tests and CI

There are no automated tests. The highest-value ones, in order:

1. `insertRowWithAllocatedId` — number allocation under concurrency is the part
   that can corrupt M1 if it regresses.
2. The gateway's table and column whitelist — it is the security boundary.
3. Zod schemas for the NCR and task payloads.

A GitHub Actions workflow running `npm ci`, `npm run typecheck`, `npm run lint`
and the tests on every push would have caught two real bugs this project hit
(a broken regex and a middleware file in the wrong directory).

### 3.5 API key handling

One shared `API_KEY` grants full API access including writes. If more than one
system will call the API, issue separate keys so one can be revoked alone, and
add rate limiting to the write endpoints.

---

## Phase 4 — Known limitations to communicate

Worth telling users before they discover them:

- **Simpro tasks cannot be linked to a job.** Simpro's API rejects Project No.
  on POST and PATCH. The job number goes into the task description and a note
  is posted on the job instead.
- **NCR numbers come from M1's `NextIDs`**, the same counter M1 itself uses, so
  app and ERP cannot collide.
- **The app never deletes.** Anything raised in error has to be handled in M1.

---

## Hosting on Azure App Service

### Shape

**One** App Service app. The UI and the API are one Next.js application — the
API routes live in `src/app/api` and are served by the same process — so a
second "API" app would double the hosting, split the session cookie across two
origins, and gain nothing. Split only if an external system ever needs its own
scaling or network exposure.

There is no separate application server to run. `next start` *is* the server;
it listens on the `PORT` App Service assigns.

### Docker: not required

App Service runs Node natively, and nothing here needs a native build step
(`mssql` is pure JavaScript). A Dockerfile buys reproducibility and an exact
Node version at the cost of a registry and a longer build. Start without it;
`engines.node` pins the version for App Service.

### The two hard problems

Both come from the app straddling the office network and the cloud.

**1. Reaching M1.** `DB_SERVER=GIZEME` is a machine on the office LAN. An
App Service app cannot reach it by default. Options, cheapest first:

- **Hybrid Connections** — an App Service feature that tunnels a single
  `host:port` (here, the SQL Server) through a relay agent installed on a
  Windows machine on the LAN. No VPN, no network redesign. Best fit here.
- **VNet integration + site-to-site VPN or ExpressRoute** — the standard
  enterprise answer, and heavier: it needs a gateway and network work.

**2. Attachments.** M1 stores the path the app writes and users open it from
the ERP. An Azure-hosted app cannot write to an office file share, and an
office PC cannot open an Azure local path. Choose one:

- **Keep files on the office share.** Simplest for M1 users, but then the app
  should stay on-premises too, which makes Azure the wrong host.
- **Store in Azure Blob Storage and record a URL** instead of a UNC path. M1's
  `ucmaSimproLink` column already proves a URL works there, and the VB button
  opens one. This needs a small code change in `attachment.repo.ts` and a
  decision about who can read the container.

**Decide this before creating Azure resources** — it determines whether Azure
is the right host at all. If attachments must stay on the office share, hosting
the app on the office server (Phase 1.6) is the simpler and cheaper answer.

### Resource group

Use an existing group only if this app shares its owner, environment,
permissions and lifecycle. Otherwise create a dedicated one — grouping by
company name alone makes deletion and access control awkward later. A single
group holding the Web App, its plan, Application Insights and Key Vault is the
usual shape.

### Custom domain

1. App Service → Custom domains → Add, e.g. `ops.remaxdoors.com`.
2. Add the CNAME and TXT records Azure shows, at your DNS provider.
3. Create a free **App Service Managed Certificate** and bind it.
4. Turn on **HTTPS Only**.
5. Set `APP_BASE_URL=https://ops.remaxdoors.com`, and add
   `https://ops.remaxdoors.com/api/auth/callback` as an Entra redirect URI.

Steps 4 and 5 are not optional: the session cookie is only marked `Secure` in
production, and Entra will reject a redirect URI that does not match exactly.

### Settings

Put every value from `.env.local` into App Service **Application settings**
(or Key Vault references). Do not deploy `.env.local` — it is git-ignored and
should stay that way. `AUTH_DEV_BYPASS` must be `false`; a production build
ignores it regardless, which is verified behaviour.

Set the health check path to `/api/health`.

---

## Release checklist

- [ ] `ops_assist_app` login created and in use; `sa` no longer in any config
- [ ] `M1_TEST` database exists and development points at it
- [ ] `AUTH_DEV_BYPASS=false`, Entra sign-in working end to end
- [ ] `ATTACHMENT_DIR` on a share; upload verified openable from a second PC
- [ ] Simpro production credentials and company id verified
- [ ] `SIMPRO_JOB_URL_TEMPLATE` verified against a real job
- [ ] `npm run build` succeeds; service starts on boot
- [ ] HTTPS in front; 4080 not publicly reachable
- [ ] `API_KEY` and `AUTH_SECRET` rotated for production
- [ ] `uqarSimproTaskID` column added
- [ ] Test data cleaned from M1 and Simpro
- [ ] Attachment share included in backups
- [ ] Uptime monitor on `/api/health`
- [ ] Repository moved off the personal account
- [ ] Attachment storage decided (office share vs Azure Blob + URL)
- [ ] M1 connectivity proven from the host (Hybrid Connection or VPN)
- [ ] Custom domain bound, HTTPS Only on, Entra redirect URI matching
- [ ] App settings populated in Azure; `.env.local` not deployed

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

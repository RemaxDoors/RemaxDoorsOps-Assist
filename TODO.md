# TODO — next session

## 1. M1 changes to apply on the server

Run against `M1_RP` as a DBA. Full detail in [m1/M1-Setup.md](m1/M1-Setup.md).

### 1.1 Simpro task ID column — needed

The app already writes to this; until the column exists it reports
"Simpro task not recorded against the NCR" and carries on.

```sql
IF COL_LENGTH('dbo.NonConformances', 'uqarSimproTaskID') IS NULL
  ALTER TABLE dbo.NonConformances ADD uqarSimproTaskID NVARCHAR(20) NULL;
```

Optional companion, if the Simpro job should be stored on the NCR too:

```sql
IF COL_LENGTH('dbo.NonConformances', 'uqarSimproJobID') IS NULL
  ALTER TABLE dbo.NonConformances ADD uqarSimproJobID NVARCHAR(20) NULL;
```

After adding, raise a test NCR and a Simpro task and confirm the column fills.

### 1.2 Form changes (Design Mode)

- **Attachments form** — text box `txtcmaSimproLink` bound to `ucmaSimproLink`,
  button `cmdOpenSimproLink`, script from [m1/OpenSimproLink.vb](m1/OpenSimproLink.vb).
  The one line likely to need adjusting for your M1 build is
  `txtcmaSimproLink.Text` in `GetSimproUrl` — two alternatives are commented
  directly beneath it.
- **Non-conformance form** — read-only box bound to `uqarSimproTaskID`,
  labelled "Simpro task".

### 1.3 Least-privilege login

The app currently connects as `sa`. Create a dedicated login with only the
grants listed in section 2 of [m1/M1-Setup.md](m1/M1-Setup.md), then update
`DB_USER` / `DB_PASSWORD`.

---

## 2. Configuration still to settle

### 2.1 `SIMPRO_JOB_URL_TEMPLATE` — unverified

`.env.local` currently guesses:

```
SIMPRO_JOB_URL_TEMPLATE=/staff/projectJob.php?jobID={jobId}
```

Open a job in Simpro, copy the URL from the address bar, and correct the
template. This is what M1's "Open in Simpro" button will use.

### 2.2 `ATTACHMENT_DIR` — blocks real use

```
ATTACHMENT_DIR=./uploads
```

Points at a folder on one laptop. M1 stores the path verbatim, so every
attachment is currently unopenable from any other machine. Change to a share
every M1 user can reach, e.g. `S:\Quality\NCR Attachments\`.

### 2.3 Microsoft sign-in

`AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID` and `AZURE_AD_CLIENT_SECRET` are
empty and `AUTH_DEV_BYPASS=true`, so the app is currently open to anyone who
can reach the port. Register the app in Entra ID with redirect URI
`http://localhost:4080/api/auth/callback`, fill the values, set the bypass to
`false`.

---

## 3. Test data to clean up

Raised while building; none of it is real.

**M1** — NCRs `10586`, `10587` (and their attachment rows `61411`–`61413`),
plus whatever the later flow tests created (`10589`, `10591`).

**Simpro QA** — tasks `42004`, `42005`, `42006`, `42008`, `42009`; job notes
`367679`, `367680`, `367712` on job 605929; and the `NCR 10589` / `NCR 10591`
attachment folders on that job.

---

## 4. Open questions

- **Simpro task Project No.** cannot be set through the API — rejected on POST
  and PATCH, and `jobs/{id}/tasks/` is search-only. The job number goes in the
  task description and a note is posted on the job instead. If linking matters,
  it needs a different Simpro integration point or manual entry.
- **Attachment visibility** — the `NCR <id>` folder and file are confirmed
  present on the Simpro job via the API, but were reported as not visible in
  the Simpro UI. Worth confirming which company and environment the UI was
  showing before treating it as a defect.
- **Automatic error emails** — the error screen opens a pre-filled mail for the
  user to send. Genuinely automatic alerts need an SMTP account for the app.

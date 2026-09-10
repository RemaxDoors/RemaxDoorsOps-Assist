# Changelog

The version shown on `/system` matches an entry here. Report it with any UAT
finding — it is the difference between "it did not work" and "it did not work
on the build that had the fix".

Versions follow semver. `-uat.N` marks a build put in front of real users but
not yet accepted.

## 1.0.0-uat.1 — 2026-09-10

First build handed to users for acceptance testing.

### Sign-in no longer re-checked on every request

Signing in happens once, when a page is opened. The app used to check again on
every background call that page made, and a lapsed session meant a filled-in
NCR could not be saved — the person had no way to satisfy the second gate
without reloading and losing their work.

- `proxy.ts` now guards pages only. It no longer touches `/api/*`.
- Saving an NCR (`POST /api/ncr`) and recording a corrective action
  (`PATCH /api/ncr/{id}`) no longer refuse for want of a session.
- The corrective action route had been reading the session **only** to refuse
  the request — the identity was never recorded — so the check cost people
  their typed-up work and stored nothing in return.

App Service Authentication remains the gate. Note that it answers `/api/*`
itself, before this app runs, so these changes only take full effect once those
paths are listed in `globalValidation.excludedPaths`.

### Response and sign-off on an NCR

Four new optional M1 columns, all guarded by `columnExists()` so the app runs
unchanged until they are added. See [m1/M1-Setup.md](m1/M1-Setup.md).

- `uqarNcrResponseText` — response / notes recorded after the corrective action
- `uqarSignedOff`, `uqarSignedOffBy`, `uqarSignedOffDate` — who approved it and
  when

The sign-off date is stamped by the server, never accepted from the browser.
Sign-off is unavailable until the corrective action is written and marked
complete, and withdraws if the NCR is reopened. Ticking it requires naming who.

### Who raised it, on screen

`uqarReportedBy` was being written and read but never displayed. The NCR detail
screen now shows it as **Entered by**, separately from **Reported by** — the
first is the account that was signed in, the second is the employee chosen from
the dropdown. On a quality record those are different claims.

### Also

- The app reports its own version, commit and build time on `/system`.
- `m1/M1-Setup.md` created. It was referenced from three places in the code and
  did not exist.
- Automatic re-authentication on a failed fetch was removed in `19d61ce`: the
  navigation it started left the page unable to complete any request, including
  ones that would have succeeded.

### Known, not fixed

- **Uploads have no total size limit.** Each file is capped at 15MB, but nothing
  caps the request. Several photos can exceed what the platform accepts, and the
  connection drops before the app sees it — which the wizard reports as "could
  not reach the server", wrongly blaming the sign-in.
- **`uqarReportedBy` is not written when there is no session**, so "Entered by"
  will be blank for saves made after a session has lapsed.
- **Fetch Job cannot be excluded by path.** `/api/simpro/job/{id}` carries the
  job number in the path, so there is no fixed string to list in
  `excludedPaths`.
- `isDatabaseUnreachable` has a dead branch — `\b` inside a template literal is
  a backspace character, not a word boundary, so that fallback never matches.
  The primary error-code check is unaffected.

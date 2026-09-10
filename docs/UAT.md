# UAT — Operation Help 1.0.0-uat.1

Who this is for: Mark, Hanna, Damian, and anyone else raising or closing NCRs.

**Before you start**, open `/system` and note the version at the top of the
page. Put that version on every issue you raise. A bug reported without it
cannot be told apart from one already fixed.

The version is also in the footer of every page.

---

## Before testing begins

These are on us, not the testers. Tick them off first — several tests below
cannot pass until they are done.

- [ ] **M1 columns added.** `uqarNcrResponseText`, `uqarSignedOff`,
      `uqarSignedOffBy`, `uqarSignedOffDate`. DDL is in
      [m1/M1-Setup.md](../m1/M1-Setup.md). Until then the NCR screen shows a
      notice and the response and sign-off fields are hidden — deliberately, so
      nobody types into a field that cannot save.
- [ ] **`/system` shows all Optional M1 columns as Pass.** This is the check
      that the step above actually worked. The app caches the answer, so
      restart the App Service after the columns are added.
- [ ] **Easy Auth `excludedPaths` set** (see the changelog). Without it, saving
      still depends on the platform session being current.
- [ ] **Confirm every tester can sign in** before test day, not on it.

---

## 1. Signing in

| # | Step | Expected |
|---|---|---|
| 1.1 | Open the app URL in a browser you have never used for it | Microsoft sign-in appears, then the dashboard |
| 1.2 | Look at the top right | Your name, without " \| Remax Doors" after it |
| 1.3 | Close the tab, reopen the URL | Straight in, no second sign-in |
| 1.4 | Open it on your phone | Same, and it can be added to the home screen |

If you are asked to **pick between two Microsoft accounts**, say so in the
report — that account picker is the cause of most "not signed in" failures, and
it is fixable at our end.

## 2. Raising an NCR

| # | Step | Expected |
|---|---|---|
| 2.1 | Add NCR → Simpro job → enter `605787` → Fetch job | Job details fill in |
| 2.2 | Try a project job, `605929` | Same |
| 2.3 | Try a number that does not exist | A plain-English message, not a code |
| 2.4 | Choose "No job" instead | The wizard continues without one |
| 2.5 | Complete the wizard and save | An NCR number comes back |
| 2.6 | Open that NCR in M1 | The record is there, with the same number |

**2.7 — Attachments.** Attach two or three photos taken on your phone, then
save. This is the case most likely to fail: there is currently **no limit on
the total size** of an upload, only 15MB per file. If the save fails, note how
many photos and roughly how large.

**2.8 — Leave it open.** Fill in the wizard, then leave the page alone for an
hour before saving. This is what Mark hit. Report the exact wording of any red
message.

## 3. The NCR screen

| # | Step | Expected |
|---|---|---|
| 3.1 | Open an NCR you raised | **Reported by** shows the employee you picked |
| 3.2 | Same screen | **Entered by** shows your own name — the account signed in |
| 3.3 | Check the Simpro job row | The job number is shown as a field, and links out |
| 3.4 | Check Severity, hours and cost | Match what you entered |

3.1 and 3.2 being different people is correct and intended.

## 4. Corrective action, response and sign-off

| # | Step | Expected |
|---|---|---|
| 4.1 | Write a corrective action, save without ticking complete | Saved, NCR stays Open |
| 4.2 | Look at the sign-off box | Greyed out — it needs a completed corrective action |
| 4.3 | Tick "Corrective action complete", save | NCR shows Closed |
| 4.4 | Fill in **NCR response / notes**, save | Text comes back after a refresh |
| 4.5 | Tick **Signed off** without choosing a person, save | Refused: "Pick who signed it off" |
| 4.6 | Choose a person, save | Saved, and the sign-off date appears |
| 4.7 | Change the wording, save again | The sign-off **date does not move** |
| 4.8 | Untick "Corrective action complete", save | NCR reopens and the sign-off is withdrawn |

4.7 and 4.8 are deliberate. A sign-off must not re-date itself when a typo is
fixed, and must not stay attached to work that has reopened.

## 5. Creating a Simpro task

| # | Step | Expected |
|---|---|---|
| 5.1 | From a saved NCR, Create Simpro task | The task appears in Simpro against the right job |
| 5.2 | Try to create a second task on the same NCR | Refused, naming the existing task |
| 5.3 | Reopen the NCR | The task id is shown |

## 6. Everyday use

| # | Step | Expected |
|---|---|---|
| 6.1 | Dashboard figures | Match what you would expect from M1 |
| 6.2 | Search and filter the NCR list | Finds what you search for |
| 6.3 | Switch the theme (light / dark / system) | Applies, and survives a reload |
| 6.4 | Click the logo | Returns to the dashboard |
| 6.5 | Use it on a phone for one real NCR | Usable one-handed on the floor |

---

## Reporting an issue

Include all five, or it cannot be chased:

1. **Version** from `/system` or the footer
2. **What you did**, step by step
3. **What you expected**
4. **What happened** — the exact wording of any message, a screenshot if you can
5. **Device and browser**, and whether you were on Wi-Fi, mobile data, or VPN

The wording matters more than it looks. "Could not reach the server" and "Your
sign-in has expired" mean two entirely different faults, and only one of them
is about signing in.

## Known before you start

Reporting these again is fine, but they are already logged:

- **Uploads have no total size cap.** Several photos in one NCR may fail with
  "could not reach the server", which wrongly blames the sign-in.
- **"Entered by" is blank** on an NCR saved after a sign-in lapsed.
- **Fetch Job** is not covered by the platform exclusion, because the job
  number sits in the URL path.
- **`/system` is visible to everyone.** Restricting it is not built yet.
- **No request logging or monitoring dashboard yet**, so a one-off failure
  cannot be traced after the fact. Please capture screenshots.

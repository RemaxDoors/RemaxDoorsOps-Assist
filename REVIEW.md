# Code review — gaps and improvements

Reviewed against the three groups who will use it: **field techs** (phone, often
one-handed, sometimes poor signal), **planners**, and **production managers**.

Roughly 7,700 lines across 60 files. The data layer is sound; the gaps are in
what the app lets people *do*, and in how it behaves on a phone.

---

## What is solid

Worth keeping as-is, so the rework below does not disturb it.

- **One door to the database.** Every query passes `src/lib/db/gateway.ts`,
  which rejects unregistered tables and columns and binds all values. Adding a
  table is one registry entry plus a repository.
- **Number allocation.** `sp_getapplock` + skip-if-taken, measured at 20
  simultaneous allocations with no collisions.
- **Degrading rather than failing.** Health checks block the form when M1 is
  down; submissions queue instead of being lost.
- **Read performance.** Dashboard ~0.17s, NCR list ~0.39s on the LAN.

---

## 1. Critical — the app does not support two of its three users

### 1.1 An NCR can be created and read, but never updated

`updateRow` is called in exactly one place, to store a Simpro task id. There is
**no way to record a corrective action, assign someone, or close an NCR.**

That is the entire working day of a planner and a production manager. Today
they must open M1 to do the part the app exists to support, which also means
the "Solved this month" figure can only ever be driven from outside the app.

**Needed:** an edit path on `/ncr/[id]` writing `qarCorrectiveActionText`,
`qarCorrectiveActionComplete`, `qarCorrectiveActionDate` and
`uqarAssignedToEmployeeID`. Those columns are already registered as writable —
this is a form and a route handler, not a data-layer change.

*Biggest single gap. Everything else on this list is smaller.*

### 1.2 Attachments cannot be seen in the app

The detail page lists a filename and a path. A tech who wants to see the photo
of the defect has to open the file share — which they cannot do from a phone in
the field.

**Needed:** a route that streams an attachment by id (authorised, path
validated against `ATTACHMENT_DIR` so it cannot be walked), and thumbnails on
the detail page. This becomes more pressing if attachments move to Blob
Storage, where a URL is available anyway.

### 1.3 Everyone sees the same list

There is no "assigned to me" or "raised by me". A tech opening the app sees the
50 newest NCRs across the business, not the three that are theirs.

**Needed:** filter on `uqarAssignedToEmployeeID` / `qarReportedByEmployeeID`,
defaulting to the signed-in user where their M1 employee id is known. This
needs a mapping from Entra identity to M1 employee id, which does not exist
yet — worth designing now, because 1.1 needs it too (who closed this?).

### 1.4 Search does not cover the description

`listNcrs` searches NCR number, job, part and part description — but not
`qarNonConformanceText`, which is where the actual problem is written. "That
bearing block issue last month" is unfindable.

---

## 2. Mobile — the primary device for one of the three groups

### 2.1 The NCR list is a six-column table on a phone

At 375px, only NCR / Part / Issue are visible; status, cause and reporter are
off-screen behind a horizontal scroll, and the date wraps to three lines.

**Needed:** below `sm`, render the same data as a stacked card per NCR — number
and status on the first line, part and description beneath, tap to open. Keep
the table for tablet and desktop. `DataTable` already centralises this, so it
is one component with a responsive branch rather than a rewrite of each page.

### 2.2 Page actions disappear on mobile

`PageHeader` renders actions as `hidden gap-2 sm:flex`. Below 640px they are
gone. On a phone that means **no "Create Simpro task", no "Back to list"** on
the NCR detail page — the hamburger only carries global actions.

That was a deliberate choice when the only actions were Refresh and Add NCR,
both of which the hamburger duplicates. It stopped being right the moment pages
gained their own actions.

**Needed:** a sticky action bar at the bottom of the viewport on small screens,
or feed page actions into the hamburger.

### 2.3 The cookie banner costs a quarter of a phone screen

It occupies ~136px of an 812px screen until dismissed, on every page. It is
correct that it no longer covers content, but on a phone it should be a compact
bar with the text collapsed.

### 2.4 No offline tolerance in the field

The server-side queue only helps once the request reaches the server. A tech in
a plant room with no signal loses the form.

**Needed, if field use is real:** persist the wizard draft to `localStorage` on
each step, restore on return, and hold submissions in the browser until
connectivity returns. This pairs naturally with the idle prompt already built.

### 2.5 Photos are uploaded at full camera resolution

A modern phone camera produces 3–8MB per shot; the cap is 15MB per file. Over
mobile data, several photos is a slow, silent upload with no progress shown.

**Needed:** downscale client-side before upload (canvas, ~1600px long edge), and
show progress. Quality is unaffected for evidence photos.

---

## 3. Code and structure

### 3.1 Two components are too large

`NcrWizard.tsx` is 576 lines and `JobStep.tsx` 522. The wizard holds all step
markup, validation, submission and the task dialog. Each step should be its own
component taking `draft` and `onChange`, with validation beside it.

This matters because the wizard is where every future field will be added.

### 3.2 Lookups are re-fetched on every request

`lookups()` runs three queries and is called from `listNcrs`, `getNcr`,
`breakdown` and `listClassifications` — so the NCR list costs four queries, the
dashboard more. Categories, codes and causes change perhaps yearly.

Not urgent at 0.39s on the LAN. It will matter over a Hybrid Connection from
Azure, where each round trip crosses the internet. Cache with `unstable_cache`
and a long revalidate.

### 3.3 Tests cover journeys, not the risky logic

The Playwright suite is good for what it does, but the two pieces that can
corrupt M1 — `insertRowWithAllocatedId` and the gateway whitelist — have no
unit tests. The concurrency behaviour was proven once, by hand, against temp
tables. That proof should be a test that runs on every change.

### 3.4 No structured logging or audit trail

Nothing records who changed what. `qarCreatedBy` captures the creator, but a
failed write leaves no trace at all. For a quality system this is likely a
compliance question, not just an operational one.

---

## 4. Security and access

### 4.1 There are no roles

Any signed-in person can do anything. A field tech can close an NCR; a manager
and a tech are indistinguishable to the app.

Given the three named groups, at least two roles are implied: **raise** (techs)
and **raise + resolve** (planners, managers). Entra app roles are the natural
mechanism, read from the token in `session.ts`.

### 4.2 One shared API key, no rate limiting

A single `API_KEY` grants full API access including writes, and there is no
throttling. If M1 forms and Power BI both call it, one leak means rotating for
everyone. Issue a key per consumer and rate-limit the write endpoints.

### 4.3 The API key never expires

No issued-at, no rotation reminder. Worth pairing with 4.2.

---

## Suggested order

Grouped by what unblocks the most people per unit of work.

| # | Item | Why first |
| --- | --- | --- |
| 1 | Corrective action + close (1.1) | Two of three user groups cannot work without it |
| 2 | Mobile list cards (2.1) + actions (2.2) | The tech's primary device is unusable for browsing |
| 3 | Entra → M1 employee mapping | Prerequisite for "my NCRs" and for recording who closed one |
| 4 | Attachment viewing (1.2) | Photos are the point of the attachment feature |
| 5 | Roles (4.1) | Cheap once identity mapping exists |
| 6 | Unit tests for allocation and whitelist (3.3) | Protects the part that can corrupt M1 |
| 7 | Draft persistence + image downscaling (2.4, 2.5) | Only if field use is genuinely on poor signal |
| 8 | Split the wizard (3.1), cache lookups (3.2) | Housekeeping; do alongside 1 and 2 |

Items 1–3 together are what turn this from a reporting tool into something the
whole quality loop runs on.

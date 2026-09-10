# M1 setup for Operation Help

What M1 needs before the app can store everything it collects.

The app runs without any of it. Every user-defined column below is read and
written only after `columnExists()` has confirmed it, so an M1 that has none of
them still raises NCRs — the extra fields just do not appear. The System page
(`/system` → "Optional M1 columns") reports which of these the connected
database actually has, so check there rather than guessing.

All of these live on `dbo.NonConformances`. The `uqar` prefix is M1's
convention for user-defined columns on that table.

## Columns

| Column | Type | Holds |
|---|---|---|
| `uqarSimproJobID` | `nvarchar(10)` | Simpro job the NCR was raised against |
| `uqarSimproTaskID` | `nvarchar(20)` | Simpro task created from the NCR |
| `uqarSeverity` | `nvarchar(10)` | Low / Medium / High / Critical |
| `uqarReportedBy` | `nvarchar(60)` | Display name of the signed-in user who entered it |
| `uqarNumAddCost` | `numeric(10,0)` | Additional cost, whole dollars |
| `uqarAddCostDetail3` | `nvarchar(200)` | What the additional cost was for |
| `uqarNcrResponseText` | `nvarchar(max)` | Response / notes recorded after the corrective action |
| `uqarSignedOff` | `bit` | Corrective action approved |
| `uqarSignedOffBy` | `nvarchar(20)` | Employee id of whoever signed it off |
| `uqarSignedOffDate` | `datetime` | When it was signed off |

`uqarReportedBy` is separate from M1's own `qarReportedByEmployeeID` on
purpose. The latter is the employee picked from a dropdown; this is the account
that was actually signed in. On a quality record those are not the same claim.

The sign-off trio deliberately mirrors M1's own
`qarCorrectiveAction{Complete,Date,Text}` — a flag, a date, and who — so the
table carries one pattern rather than two.

## Adding the response and sign-off columns

These are the four the app does not yet find in production. They are nullable,
so adding them changes nothing about existing rows.

```sql
ALTER TABLE dbo.NonConformances ADD uqarNcrResponseText nvarchar(max) NULL;
ALTER TABLE dbo.NonConformances ADD uqarSignedOff       bit           NULL;
ALTER TABLE dbo.NonConformances ADD uqarSignedOffBy     nvarchar(20)  NULL;
ALTER TABLE dbo.NonConformances ADD uqarSignedOffDate   datetime      NULL;
```

Then confirm the app can see them:

```sql
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM   INFORMATION_SCHEMA.COLUMNS
WHERE  TABLE_NAME = 'NonConformances'
AND    COLUMN_NAME LIKE 'uqar%'
ORDER  BY COLUMN_NAME;
```

The app caches the answer to "does this column exist", so a restart (or waiting
out the cache) is needed before newly added columns are picked up.

### If they were added as NOT NULL

That is what happened in `M1_T1`, and it is the normal outcome — SQL Server
requires a default when a NOT NULL column is added to a table that already has
rows, so the existing NCRs were filled in automatically.

It matters because clearing such a column with NULL fails the whole `UPDATE`:

```
Cannot insert the value NULL into column 'uqarSignedOffBy' ... UPDATE fails.
```

That took the corrective action down with it — an ordinary save that never
touched the sign-off could not be recorded at all. The app no longer writes
NULL to any of them: an unset sign-off is stored as an empty string, and the
date is left as it was rather than cleared. Nothing needs changing in M1, but
if these are ever recreated, nullable is the simpler shape.

## Widths worth knowing

`qarCreatedBy` is `nvarchar(20)` and every existing row holds an employee id —
`DC`, `DJZ`, `RP` — not an email. `uqarSignedOffBy` matches that width for the
same reason: an email would not fit and would not match anything else in M1.

`uqarReportedBy` is written truncated to 60 characters. That width has not been
confirmed against production; if it is narrower, the value is silently cut
rather than rejected.

## Permissions

Object-level grants for the app's SQL login are in
[`grant-ops-assist-app.sql`](grant-ops-assist-app.sql). `DELETE` is denied
throughout — the app never removes an M1 record. Adding a column does not
change the grants, so nothing needs re-running after the `ALTER TABLE`s above.

# M1 setup for Operation Help

Everything that has to be added inside M1 for the app to work. Run the SQL as a
DBA against the M1 database (`M1_RP`), then make the form changes in Design Mode.

Nothing here changes M1's own tables beyond adding user-defined (`u`-prefixed)
columns, which is the convention M1 uses for custom fields.

---

## 1. Columns

### 1.1 `ucmaSimproLink` on `dbo.Attachments` — already added

Holds a link to the copy of an attachment stored on the Simpro job.

```sql
IF COL_LENGTH('dbo.Attachments', 'ucmaSimproLink') IS NULL
  ALTER TABLE dbo.Attachments ADD ucmaSimproLink NVARCHAR(255) NULL;
```

### 1.2 `uqarSimproTaskID` on `dbo.NonConformances` — to add

Records the Simpro task raised for an NCR, so M1 can point back at it.

```sql
IF COL_LENGTH('dbo.NonConformances', 'uqarSimproTaskID') IS NULL
  ALTER TABLE dbo.NonConformances ADD uqarSimproTaskID NVARCHAR(20) NULL;
```

Optional, if you also want the job note reference:

```sql
IF COL_LENGTH('dbo.NonConformances', 'uqarSimproJobID') IS NULL
  ALTER TABLE dbo.NonConformances ADD uqarSimproJobID NVARCHAR(20) NULL;
```

The app writes these only when the column exists — it checks first and reports a
warning rather than failing, so you can add them whenever suits.

---

## 2. Permissions

The app's login needs no more than this:

```sql
GRANT SELECT, INSERT, UPDATE ON dbo.NonConformances TO ops_assist_app;
GRANT SELECT, INSERT, UPDATE ON dbo.Attachments     TO ops_assist_app;
GRANT SELECT, UPDATE          ON dbo.NextIDs        TO ops_assist_app;
GRANT SELECT ON dbo.NonConformanceCategories TO ops_assist_app;
GRANT SELECT ON dbo.NonConformanceCodes      TO ops_assist_app;
GRANT SELECT ON dbo.NonConformanceCauses     TO ops_assist_app;
GRANT SELECT ON dbo.Jobs                     TO ops_assist_app;
GRANT SELECT ON dbo.Employees                TO ops_assist_app;
```

`NextIDs` needs UPDATE because the app allocates NCR and attachment numbers the
same way M1 does — see section 4.

---

## 3. Form changes (Design Mode)

### 3.1 Attachments form — open the Simpro copy

1. Add a text box bound to `ucmaSimproLink`, named **`txtcmaSimproLink`**.
2. Add a button named **`cmdOpenSimproLink`**, caption "Open in Simpro".
3. Paste the script from [`OpenSimproLink.vb`](OpenSimproLink.vb).

### 3.2 Non-conformance form — show the Simpro task

1. Add a read-only text box bound to `uqarSimproTaskID`, labelled "Simpro task".
2. Optionally add a button to open it, reusing the same pattern as above with
   the URL `https://<your-simpro>/staff/taskDetails.php?id=<task id>`.

---

## 4. How the app allocates numbers

M1 keeps the next number for each table in `dbo.NextIDs` (`xanTable` ->
`xanNextID`). The app uses that same row: it reads it under `UPDLOCK`, inserts,
and advances the counter inside one transaction, so numbers issued by the app
and numbers issued inside M1 cannot collide.

If a counter is ever behind its table, the higher of the two wins and the
counter self-heals. To check for drift:

```sql
SELECT n.xanTable, n.xanNextID,
       CASE n.xanTable
         WHEN 'NonConformances' THEN
           (SELECT MAX(TRY_CAST(qarNonConformanceID AS bigint)) FROM dbo.NonConformances)
         WHEN 'Attachments' THEN
           (SELECT MAX(TRY_CAST(cmaAttachmentID AS bigint)) FROM dbo.Attachments)
       END AS tableMax
FROM dbo.NextIDs n
WHERE n.xanTable IN ('NonConformances', 'Attachments');
```

`xanNextID` should always be greater than `tableMax`.

---

## 5. Attachment storage

M1 stores attachments as a **file path** (`cmaFileLocation`), not a blob — of
61k rows, none populate `cmaBLOB`. The app writes the uploaded file to the
directory named by `ATTACHMENT_DIR`, then records that path.

**`ATTACHMENT_DIR` must point at a share every M1 user can open** (for example
`S:\Quality\NCR Attachments\`). If it points at a local folder, M1 will show a
path that only works on the machine that uploaded it.

---

## 6. Tables the app touches

| Table | Access | Used for |
| --- | --- | --- |
| `NonConformances` | read + insert | NCR list, detail, creation |
| `Attachments` | read + insert | NCR photos and documents |
| `NextIDs` | read + update | Allocating NCR and attachment numbers |
| `NonConformanceCategories` | read | Category picklist |
| `NonConformanceCodes` | read | Code picklist |
| `NonConformanceCauses` | read | Cause picklist |
| `Jobs` | read | M1 job search |
| `Employees` | read | Reported by / assigned to |

Nothing else is reachable: the app's data gateway rejects any table or column
not declared in `src/lib/db/tables.ts`.

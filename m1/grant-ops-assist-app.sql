/* ---------------------------------------------------------------------------
   Permissions for the Operation Help application login.

   Least privilege by design: object-level grants only, no database roles.
   db_datareader / db_datawriter would hand the app every table in M1,
   including payroll and pricing, and would put DELETE one role change away.

   Everything the app can do passes src/lib/db/gateway.ts, which rejects any
   table or column not in its registry. These grants are the second lock: if
   that whitelist were ever bypassed, SQL Server still refuses.

   Run against the M1 database as a sysadmin. Safe to re-run.
--------------------------------------------------------------------------- */

USE [M1_RP];
GO

/* --- Database user -----------------------------------------------------
   The server login must already exist. Create it separately so the password
   never lands in a file that gets committed.                             */
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'ops_assist_app')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'ops_assist_app')
        CREATE USER [ops_assist_app] FOR LOGIN [ops_assist_app] WITH DEFAULT_SCHEMA = [dbo];
    ELSE
        THROW 50100, N'Server login ops_assist_app does not exist. Create it first, then re-run.', 1;
END
GO

/* --- Read-only: lookups, job search, staff list ------------------------ */
GRANT SELECT ON [dbo].[Jobs]                     TO [ops_assist_app];
GRANT SELECT ON [dbo].[Employees]                TO [ops_assist_app];
GRANT SELECT ON [dbo].[NonConformanceCategories] TO [ops_assist_app];
GRANT SELECT ON [dbo].[NonConformanceCodes]      TO [ops_assist_app];
GRANT SELECT ON [dbo].[NonConformanceCauses]     TO [ops_assist_app];
GO

/* --- Read/write: the records the app creates --------------------------- */
GRANT SELECT, INSERT, UPDATE ON [dbo].[NonConformances] TO [ops_assist_app];
GRANT SELECT, INSERT, UPDATE ON [dbo].[Attachments]     TO [ops_assist_app];
GO

/* --- M1's own ID allocator ---------------------------------------------
   The app reads the counter and advances it so its NCR numbers stay in step
   with M1's own. It never adds a row, so no INSERT.                      */
GRANT SELECT, UPDATE ON [dbo].[NextIDs] TO [ops_assist_app];
GO

/* --- No deletes, ever --------------------------------------------------
   The app issues no DELETE, so these are belt and braces. They earn their
   place because DENY outranks GRANT: if this login is ever added to a role
   carrying delete rights, these still hold.                              */
DENY DELETE ON [dbo].[NonConformances]           TO [ops_assist_app];
DENY DELETE ON [dbo].[Attachments]               TO [ops_assist_app];
DENY DELETE ON [dbo].[NextIDs]                   TO [ops_assist_app];
DENY DELETE ON [dbo].[Jobs]                      TO [ops_assist_app];
DENY DELETE ON [dbo].[Employees]                 TO [ops_assist_app];
DENY DELETE ON [dbo].[NonConformanceCategories]  TO [ops_assist_app];
DENY DELETE ON [dbo].[NonConformanceCodes]       TO [ops_assist_app];
DENY DELETE ON [dbo].[NonConformanceCauses]      TO [ops_assist_app];
GO

/* --- Verify -------------------------------------------------------------
   Lists exactly what the login ended up with. Anything unexpected here is
   arriving through a role membership, not through this script.           */
SELECT
    OBJECT_SCHEMA_NAME(p.major_id) AS [schema],
    OBJECT_NAME(p.major_id)        AS [table],
    p.permission_name,
    p.state_desc
FROM sys.database_permissions AS p
JOIN sys.database_principals  AS u ON u.principal_id = p.grantee_principal_id
WHERE u.name = N'ops_assist_app'
  AND p.class = 1
ORDER BY [table], p.permission_name;
GO

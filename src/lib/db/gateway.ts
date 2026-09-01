import "server-only";
import { getPool, sql } from "@/lib/db/client";
import { qualified, sqlTypeFor, tables, type TableKey } from "@/lib/db/tables";

/**
 * The only way the app talks to M1. Every table, column and sort key is
 * checked against the registry in ./tables.ts, and every value is bound as a
 * parameter — so no caller can compose raw SQL or reach an untracked table.
 */

export type Filter = {
  column: string;
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
  value: string | number | Date | boolean;
};

/** A group of filters is OR'd together; the top-level list is AND'd. */
export type Condition = Filter | Filter[];

export type ReadOptions = {
  columns?: readonly string[];
  where?: readonly Condition[];
  orderBy?: { column: string; direction?: "asc" | "desc" };
  limit?: number;
};

const OPS: Record<Filter["op"], string> = {
  eq: "=",
  neq: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  contains: "LIKE",
};

function assertColumns(
  table: TableKey,
  allowed: readonly string[],
  requested: readonly string[],
) {
  for (const col of requested) {
    if (!allowed.includes(col)) {
      throw new Error(`Column "${col}" is not permitted on table "${table}"`);
    }
  }
}

function flatten(where: readonly Condition[]): Filter[] {
  return where.flatMap((c) => (Array.isArray(c) ? c : [c]));
}

/**
 * Binds every filter value as a typed parameter and returns the SQL for the
 * WHERE clause. Column names are registry-checked before they get here.
 */
function buildWhere(
  table: TableKey,
  where: readonly Condition[],
  request: sql.Request,
) {
  const def = tables[table];
  assertColumns(table, def.readable, flatten(where).map((f) => f.column));

  let index = 0;
  const groups = where.map((condition) => {
    const filters = Array.isArray(condition) ? condition : [condition];
    const parts = filters.map((filter) => {
      const param = `p${index++}`;
      const type = sqlTypeFor(
        def.columns[filter.column as keyof typeof def.columns],
      );
      const value =
        filter.op === "contains" ? `%${String(filter.value)}%` : filter.value;
      request.input(param, type, value as never);
      return `[${filter.column}] ${OPS[filter.op]} @${param}`;
    });
    return parts.length > 1 ? `(${parts.join(" OR ")})` : parts[0];
  });

  return groups.length ? `WHERE ${groups.join(" AND ")}` : "";
}

/** SELECT from a registered table. */
export async function readRows<T = Record<string, unknown>>(
  table: TableKey,
  options: ReadOptions = {},
): Promise<T[]> {
  const def = tables[table];
  const columns = options.columns ?? def.readable;
  assertColumns(table, def.readable, columns);
  if (options.orderBy) assertColumns(table, def.readable, [options.orderBy.column]);

  const pool = await getPool();
  const request = pool.request();

  const where = buildWhere(table, options.where ?? [], request);
  const top = options.limit
    ? `TOP (${Math.min(Math.trunc(options.limit), 1000)})`
    : "";
  const select = columns.map((c) => `[${c}]`).join(", ");
  const order = options.orderBy
    ? `ORDER BY [${options.orderBy.column}] ${options.orderBy.direction === "asc" ? "ASC" : "DESC"}`
    : "";

  const result = await request.query(
    `SELECT ${top} ${select} FROM ${qualified(def)} ${where} ${order}`,
  );
  return result.recordset as T[];
}

/** COUNT(*) on a registered table. */
export async function countRows(
  table: TableKey,
  where: readonly Condition[] = [],
): Promise<number> {
  const pool = await getPool();
  const request = pool.request();
  const clause = buildWhere(table, where, request);

  const result = await request.query(
    `SELECT COUNT(*) AS total FROM ${qualified(tables[table])} ${clause}`,
  );
  return Number(result.recordset[0]?.total ?? 0);
}

/** INSERT one row, returning the generated primary key. */
export async function insertRow(
  table: TableKey,
  values: Record<string, unknown>,
): Promise<number> {
  const def = tables[table];
  const columns = Object.keys(values);
  if (columns.length === 0) throw new Error("insertRow called with no values");
  assertColumns(table, def.writable, columns);

  const pool = await getPool();
  const request = pool.request();
  columns.forEach((col, i) => {
    request.input(
      `v${i}`,
      sqlTypeFor(def.columns[col as keyof typeof def.columns]),
      values[col] as never,
    );
  });

  const result = await request.query(
    `INSERT INTO ${qualified(def)} (${columns.map((c) => `[${c}]`).join(", ")})
     OUTPUT INSERTED.[${def.primaryKey}] AS id
     VALUES (${columns.map((_, i) => `@v${i}`).join(", ")})`,
  );
  return Number(result.recordset[0]?.id);
}

/** UPDATE one row by primary key. Returns rows affected. */
export async function updateRow(
  table: TableKey,
  id: string | number,
  values: Record<string, unknown>,
): Promise<number> {
  const def = tables[table];
  const columns = Object.keys(values);
  if (columns.length === 0) return 0;
  assertColumns(table, def.writable, columns);

  const pool = await getPool();
  const request = pool.request();
  columns.forEach((col, i) => {
    request.input(
      `v${i}`,
      sqlTypeFor(def.columns[col as keyof typeof def.columns]),
      values[col] as never,
    );
  });
  request.input(
    "pk",
    sqlTypeFor(def.columns[def.primaryKey as keyof typeof def.columns]),
    id as never,
  );

  const result = await request.query(
    `UPDATE ${qualified(def)}
     SET ${columns.map((c, i) => `[${c}] = @v${i}`).join(", ")}
     WHERE [${def.primaryKey}] = @pk`,
  );
  return result.rowsAffected[0] ?? 0;
}

/**
 * Reads the next ID M1 would hand out for a table, without consuming it.
 * Used to show the number on screen before anything is saved.
 */
export async function peekNextId(table: TableKey): Promise<string | null> {
  const def = tables[table];
  const pool = await getPool();
  const result = await pool
    .request()
    .input("t", sql.NVarChar(30), def.name)
    .query(
      `SELECT CAST(
         CASE WHEN TRY_CAST(n.xanNextID AS bigint) > ISNULL(m.maxId, 0)
              THEN TRY_CAST(n.xanNextID AS bigint)
              ELSE ISNULL(m.maxId, 0) + 1
         END AS nvarchar(30)) AS id
       FROM ${qualified(tables.nextId)} n
       CROSS APPLY (
         SELECT MAX(TRY_CAST([${def.primaryKey}] AS bigint)) AS maxId
         FROM ${qualified(def)}
       ) m
       WHERE n.xanTable = @t`,
    );
  return result.recordset[0]?.id ? String(result.recordset[0].id) : null;
}

/**
 * INSERT one row, taking its primary key from M1's own NextIDs allocator and
 * advancing that counter in the same transaction — so numbers issued here and
 * numbers issued inside M1 can never collide.
 *
 * The allocator is trusted unless it has fallen behind the table (which can
 * happen if something wrote without updating it); in that case the higher of
 * the two wins, so a stale counter self-heals instead of colliding.
 */
export async function insertRowWithAllocatedId(
  table: TableKey,
  values: Record<string, unknown>,
): Promise<string> {
  const def = tables[table];
  const idColumn = def.primaryKey;
  const columns = Object.keys(values);
  assertColumns(table, def.writable, [...columns, idColumn]);
  if (columns.includes(idColumn)) {
    throw new Error(`${idColumn} is allocated by the gateway, not by callers`);
  }

  const pool = await getPool();
  const request = pool.request();
  request.input("t", sql.NVarChar(30), def.name);
  columns.forEach((col, i) => {
    request.input(
      `v${i}`,
      sqlTypeFor(def.columns[col as keyof typeof def.columns]),
      values[col] as never,
    );
  });

  const result = await request.query(
    `SET XACT_ABORT ON;
     DECLARE @next bigint, @counter bigint, @tableMax bigint;

     BEGIN TRANSACTION;

       SELECT @counter = TRY_CAST(xanNextID AS bigint)
       FROM ${qualified(tables.nextId)} WITH (UPDLOCK, HOLDLOCK)
       WHERE xanTable = @t;

       IF @counter IS NULL
         THROW 50001, 'No NextIDs row for this table', 1;

       SELECT @tableMax = MAX(TRY_CAST([${idColumn}] AS bigint))
       FROM ${qualified(def)} WITH (UPDLOCK, HOLDLOCK);

       SET @next = CASE
         WHEN @counter > ISNULL(@tableMax, 0) THEN @counter
         ELSE ISNULL(@tableMax, 0) + 1
       END;

       INSERT INTO ${qualified(def)} ([${idColumn}]${columns.map((c) => `, [${c}]`).join("")})
       VALUES (CAST(@next AS nvarchar(30))${columns.map((_, i) => `, @v${i}`).join("")});

       UPDATE ${qualified(tables.nextId)}
       SET xanNextID = CAST(@next + 1 AS nvarchar(30))
       WHERE xanTable = @t;

     COMMIT TRANSACTION;

     SELECT CAST(@next AS nvarchar(30)) AS id;`,
  );

  const id = result.recordset[0]?.id;
  if (!id) throw new Error(`Insert into ${table} did not return an id`);
  return String(id);
}

/**
 * Whether a column is actually present, cached per process.
 *
 * Lets the app use user-defined M1 columns that a DBA may not have added yet,
 * reporting a clear warning instead of failing the whole operation.
 */
const columnCache = new Map<string, boolean>();

export async function columnExists(
  table: TableKey,
  column: string,
): Promise<boolean> {
  const def = tables[table];
  const key = `${def.schema}.${def.name}.${column}`;
  const cached = columnCache.get(key);
  if (cached !== undefined) return cached;

  const pool = await getPool();
  const result = await pool
    .request()
    .input("s", sql.NVarChar(128), def.schema)
    .input("t", sql.NVarChar(128), def.name)
    .input("c", sql.NVarChar(128), column)
    .query(
      `SELECT 1 AS present FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = @s AND TABLE_NAME = @t AND COLUMN_NAME = @c`,
    );

  const present = result.recordset.length > 0;
  columnCache.set(key, present);
  return present;
}

export async function pingDatabase() {
  const pool = await getPool();
  const result = await pool.request().query("SELECT 1 AS ok");
  return result.recordset[0]?.ok === 1;
}

export { sql };

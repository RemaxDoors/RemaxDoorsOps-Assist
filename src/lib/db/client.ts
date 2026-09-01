import "server-only";
import sql from "mssql";

/**
 * Single pooled connection to the M1 SQL Server, cached across hot reloads.
 * Nothing outside src/lib/db imports this module — callers go through the
 * gateway in ./gateway.ts, which only allows registered tables and columns.
 */
declare global {
  // eslint-disable-next-line no-var
  var __m1Pool: Promise<sql.ConnectionPool> | undefined;
}

const REQUIRED = ["DB_SERVER", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const;

export function missingDbConfig() {
  return REQUIRED.filter((key) => !process.env[key]);
}

export function isDatabaseConfigured() {
  return missingDbConfig().length === 0;
}

function config(): sql.config {
  const missing = missingDbConfig();
  if (missing.length) {
    throw new Error(
      `M1 database is not configured. Missing in .env.local: ${missing.join(", ")}`,
    );
  }

  return {
    server: process.env.DB_SERVER!,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT !== "false",
      enableArithAbort: true,
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    connectionTimeout: 15_000,
    requestTimeout: 30_000,
  };
}

export function getPool(): Promise<sql.ConnectionPool> {
  if (!globalThis.__m1Pool) {
    globalThis.__m1Pool = new sql.ConnectionPool(config())
      .connect()
      .catch((error) => {
        globalThis.__m1Pool = undefined; // let the next call retry
        throw error;
      });
  }
  return globalThis.__m1Pool;
}

export { sql };

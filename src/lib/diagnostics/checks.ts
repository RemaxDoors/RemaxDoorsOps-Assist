import "server-only";
import { access, constants, mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { columnExists, peekNextId, pingDatabase, readRows } from "@/lib/db/gateway";
import { isDatabaseConfigured, missingDbConfig } from "@/lib/db/client";
import { isSimproConfigured, listSimproStaff } from "@/lib/simpro/client";
import { listFailed, listPending } from "@/lib/queue/submissionQueue";
import { tables, type TableKey } from "@/lib/db/tables";
import { environmentState } from "@/lib/config/environment";
import { identityTrust, onAppService } from "@/lib/auth/platform";

/**
 * Self-checks that run *inside* the deployed environment.
 *
 * The point is that the Azure instance is the only place several of these can
 * be answered. Whether a share is writable, whether the platform is attaching
 * identity headers, whether a user-defined column exists in the database this
 * instance is actually pointed at — none of that can be established from a
 * laptop, and getting it wrong has cost us a day at a time.
 *
 * Every check is non-destructive and safe to run in production. Nothing here
 * returns a secret: settings are reported as set or missing, never by value.
 */

export type CheckStatus = "pass" | "warn" | "fail";

export type Check = {
  id: string;
  group: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Milliseconds, where the check did real work. */
  ms?: number;
};

export type Diagnostics = {
  ranAt: string;
  ms: number;
  summary: Record<CheckStatus, number>;
  ok: boolean;
  checks: Check[];
};

const isProduction = process.env.NODE_ENV === "production";

async function timed<T>(fn: () => Promise<T>): Promise<[T | null, number, unknown]> {
  const started = Date.now();
  try {
    return [await fn(), Date.now() - started, null];
  } catch (error) {
    return [null, Date.now() - started, error];
  }
}

const reason = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/* ---------------------------------------------------------------- settings */

/**
 * Reports presence, never value. A missing required setting is a fault;
 * everything else only degrades a feature, so it is a warning.
 */
function settingChecks(): Check[] {
  const set = (name: string) => Boolean((process.env[name] ?? "").trim());

  const required: Array<[string, string]> = [
    ["DB_SERVER", "M1 host"],
    ["DB_NAME", "M1 database"],
    ["DB_USER", "M1 login"],
    ["DB_PASSWORD", "M1 password"],
  ];

  const optional: Array<[string, string, string]> = [
    ["SIMPRO_BASE_URL", "Simpro host", "Job lookup and tasks are unavailable"],
    ["SIMPRO_API_TOKEN", "Simpro token", "Job lookup and tasks are unavailable"],
    ["ATTACHMENT_DIR", "Attachment location", "Photos cannot be saved"],
    ["QUEUE_DIR", "Queue location", "Submissions cannot be held when M1 is down"],
  ];

  const checks: Check[] = required.map(([name, label]) => ({
    id: `setting.${name}`,
    group: "Settings",
    label: `${name} — ${label}`,
    status: set(name) ? "pass" : "fail",
    detail: set(name) ? "Set" : "Missing. The app cannot reach M1 without it.",
  }));

  for (const [name, label, consequence] of optional) {
    checks.push({
      id: `setting.${name}`,
      group: "Settings",
      label: `${name} — ${label}`,
      status: set(name) ? "pass" : "warn",
      detail: set(name) ? "Set" : `Not set. ${consequence}.`,
    });
  }

  // The bypass opens the app to anyone with the URL. Production builds ignore
  // it, but its presence still means somebody intended to disable the gate.
  const bypass = process.env.AUTH_DEV_BYPASS === "true";
  checks.push({
    id: "setting.AUTH_DEV_BYPASS",
    group: "Settings",
    label: "AUTH_DEV_BYPASS — sign-in bypass",
    status: bypass && isProduction ? "warn" : "pass",
    detail: bypass
      ? isProduction
        ? "Set to true. This production build ignores it, but remove it to avoid confusion."
        : "On, as expected for local development."
      : "Off",
  });

  return checks;
}

/* ---------------------------------------------------------------- platform */

/** Whether App Service Authentication is actually in front of this app. */
async function platformChecks(): Promise<Check[]> {
  const store = await headers();
  const principal =
    store.get("x-ms-client-principal-name") ?? store.get("x-ms-client-principal-id");
  const isAppService = onAppService();

  const checks: Check[] = [
    {
      id: "platform.host",
      group: "Platform",
      label: "Hosting",
      status: "pass",
      detail: isAppService
        ? `Azure App Service — ${process.env.WEBSITE_SITE_NAME}, instance ${
            process.env.WEBSITE_INSTANCE_ID?.slice(0, 8) ?? "unknown"
          }`
        : `Local — Node ${process.version}`,
    },
    {
      id: "platform.node",
      group: "Platform",
      label: "Node version",
      status: Number(process.versions.node.split(".")[0]) >= 22 ? "pass" : "warn",
      detail: process.version,
    },
  ];

  if (isAppService) {
    const trust = identityTrust();
    checks.push({
      id: "platform.easyauth",
      group: "Platform",
      label: "App Service Authentication",
      status: principal ? "pass" : "warn",
      detail: principal
        ? `Identity headers present — signed in as ${principal}`
        : "No identity headers on this request. Either this was called with an API key, or the identity provider is not attaching them.",
    });
    checks.push({
      id: "platform.identity-trust",
      group: "Platform",
      label: "Identity headers can be trusted",
      // Unverified is a warning, not a pass: it means we could not confirm the
      // platform is stripping client-supplied identity headers.
      status:
        trust.basis === "verified"
          ? "pass"
          : trust.basis === "disabled"
            ? "fail"
            : "warn",
      detail: trust.detail,
    });
  }

  return checks;
}

/* ------------------------------------------------------------- environment */

/**
 * Which world each integration is pointed at. A production M1 paired with a
 * QA Simpro writes a real quality record and a task nobody reads.
 */
function environmentChecks(): Check[] {
  const state = environmentState();
  const named = (value: string) => value !== "unknown";

  // Environment labels are not secrets, so the actual value is shown — the
  // whole failure mode here is a name mismatch between Azure and the code,
  // and "set/not set" would not have revealed it.
  const declared = (name: string) => {
    const raw = (process.env[name] ?? "").trim();
    return raw ? `${name}=${raw}` : `${name} NOT SET`;
  };

  return [
    {
      id: "env.declared",
      group: "Environment",
      label: "Declared environments",
      status: named(state.m1) && named(state.simpro) ? "pass" : "warn",
      detail: `Application ${state.app} · M1 ${state.m1} · Simpro ${state.simpro}`,
    },
    {
      id: "env.variables",
      group: "Environment",
      label: "Environment settings as the process sees them",
      status:
        named(state.app) && named(state.m1) && named(state.simpro)
          ? "pass"
          : "warn",
      detail: [
        declared("APP_ENVIRONMENT"),
        declared("M1_ENVIRONMENT"),
        declared("SIMPRO_ENVIRONMENT"),
      ].join(" · "),
    },
    {
      id: "env.writes",
      group: "Environment",
      label: "Writes to M1 and Simpro",
      status: state.writesAllowed ? "pass" : "fail",
      detail: state.writesAllowed
        ? `Enabled. ${state.reason}`
        : `BLOCKED. ${state.reason}`,
    },
  ];
}

/* ---------------------------------------------------------------- database */

/** One row read from every registered table, so a permission gap shows up. */
async function tableChecks(): Promise<Check[]> {
  const keys = Object.keys(tables) as TableKey[];
  return Promise.all(
    keys.map(async (key) => {
      const def = tables[key];
      const [, ms, error] = await timed(() =>
        readRows(key, { columns: [def.primaryKey], limit: 1 }),
      );
      return {
        id: `db.table.${key}`,
        group: "Database tables",
        label: `${def.schema}.${def.name}`,
        status: error ? ("fail" as const) : ("pass" as const),
        detail: error ? reason(error) : "Readable",
        ms,
      };
    }),
  );
}

/**
 * User-defined columns. Absent is a warning, not a failure — the app is built
 * to work without them — but knowing which environment has which is the thing
 * that keeps catching us out.
 */
const OPTIONAL_COLUMNS: Array<[TableKey, string, string]> = [
  ["ncr", "uqarSimproJobID", "Simpro job link on the NCR"],
  ["ncr", "uqarSimproTaskID", "Simpro task id stored back on the NCR"],
  ["ncr", "uqarSeverity", "Severity"],
  ["ncr", "uqarReportedBy", "Entra display name of whoever raised it"],
  ["ncr", "uqarNumAddCost", "Extra cost"],
  ["ncr", "uqarAddCostDetail3", "What the extra cost was for"],
];

async function columnChecks(): Promise<Check[]> {
  return Promise.all(
    OPTIONAL_COLUMNS.map(async ([table, column, purpose]) => {
      const [present, ms, error] = await timed(() => columnExists(table, column));
      return {
        id: `db.column.${column}`,
        group: "Optional M1 columns",
        label: `${column} — ${purpose}`,
        status: error
          ? ("fail" as const)
          : present
            ? ("pass" as const)
            : ("warn" as const),
        detail: error
          ? reason(error)
          : present
            ? "Present"
            : "Not in this database. The field is skipped on read and write.",
        ms,
      };
    }),
  );
}

/**
 * M1 allocates NCR numbers from a counter row. Reading it proves the allocator
 * can see what it needs before someone discovers otherwise mid-save.
 */
async function counterCheck(): Promise<Check> {
  const [next, ms, error] = await timed(() => peekNextId("ncr"));
  if (error) {
    return {
      id: "db.counter",
      group: "Database",
      label: "NCR number allocator",
      status: "fail",
      detail: reason(error),
      ms,
    };
  }
  return {
    id: "db.counter",
    group: "Database",
    label: "NCR number allocator",
    status: next ? "pass" : "warn",
    detail: next
      ? `Next NCR number would be ${next}`
      : "No counter row found in dbo.NextIDs for NonConformances.",
    ms,
  };
}

async function databaseChecks(): Promise<Check[]> {
  if (!isDatabaseConfigured()) {
    return [
      {
        id: "db.connect",
        group: "Database",
        label: "M1 connection",
        status: "fail",
        detail: `Not configured. Missing: ${missingDbConfig().join(", ")}`,
      },
    ];
  }

  const [, ms, error] = await timed(pingDatabase);
  const connect: Check = {
    id: "db.connect",
    group: "Database",
    label: "M1 connection",
    status: error ? "fail" : ms > 2000 ? "warn" : "pass",
    detail: error
      ? reason(error)
      : `${process.env.DB_SERVER}/${process.env.DB_NAME} responded in ${ms}ms${
          ms > 2000 ? " — slower than expected" : ""
        }`,
    ms,
  };

  // Nothing below can succeed if the connection failed, and running them would
  // produce a wall of identical errors.
  if (error) return [connect];

  return [
    connect,
    await counterCheck(),
    ...(await tableChecks()),
    ...(await columnChecks()),
  ];
}

/* ------------------------------------------------------------------ simpro */

async function simproChecks(): Promise<Check[]> {
  if (!isSimproConfigured()) {
    return [
      {
        id: "simpro.connect",
        group: "Simpro",
        label: "Simpro connection",
        status: "warn",
        detail:
          "Not configured. Check SIMPRO_BASE_URL, SIMPRO_API_TOKEN and SIMPRO_COMPANY_ID.",
      },
    ];
  }

  // Listing staff proves the token, the company id and the host in one call —
  // and it is the exact call the task dialog makes, so an empty "Assigned to"
  // shows up here rather than only when someone tries to raise a task.
  const [staff, ms, error] = await timed(listSimproStaff);
  return [
    {
      id: "simpro.connect",
      group: "Simpro",
      label: "Simpro connection",
      status: error ? "fail" : "pass",
      detail: error
        ? reason(error)
        : `Company ${process.env.SIMPRO_COMPANY_ID ?? "(taken from the base URL)"} — ${
            staff?.length ?? 0
          } staff available to assign`,
      ms,
    },
  ];
}

/* -------------------------------------------------------------- filesystem */

/**
 * Writes and deletes a probe file. On App Service the deployment directory is
 * read-only, so a path under it fails here rather than the first time somebody
 * attaches a photo.
 */
async function writableCheck(
  id: string,
  label: string,
  dir: string | undefined,
  consequence: string,
): Promise<Check> {
  if (!dir) {
    return {
      id,
      group: "Storage",
      label,
      status: "warn",
      detail: `Not set. ${consequence}`,
    };
  }

  const resolved = path.resolve(dir);
  const probe = path.join(resolved, `.write-probe-${Date.now()}`);
  const [, ms, error] = await timed(async () => {
    await mkdir(resolved, { recursive: true });
    await access(resolved, constants.W_OK);
    await writeFile(probe, "probe");
    await unlink(probe);
  });

  return {
    id,
    group: "Storage",
    label,
    status: error ? "fail" : "pass",
    detail: error ? `${resolved} — ${reason(error)}` : `${resolved} — writable`,
    ms,
  };
}

async function storageChecks(): Promise<Check[]> {
  const [attachments, queueDir, pending, failed] = await Promise.all([
    writableCheck(
      "storage.attachments",
      "ATTACHMENT_DIR",
      process.env.ATTACHMENT_DIR,
      "Photos cannot be saved.",
    ),
    writableCheck(
      "storage.queue",
      "QUEUE_DIR",
      process.env.QUEUE_DIR,
      "Submissions cannot be held when M1 is down.",
    ),
    listPending().catch(() => []),
    listFailed().catch(() => []),
  ]);

  return [
    attachments,
    queueDir,
    {
      id: "queue.depth",
      group: "Storage",
      label: "Submission queue",
      status: failed.length > 0 ? "fail" : pending.length > 0 ? "warn" : "pass",
      detail:
        failed.length > 0
          ? `${failed.length} failed and ${pending.length} waiting. The failed entries need a look.`
          : pending.length > 0
            ? `${pending.length} waiting to be submitted to M1.`
            : "Empty",
    },
  ];
}

/* --------------------------------------------------------------------- run */

export async function runDiagnostics(): Promise<Diagnostics> {
  const started = Date.now();

  const groups = await Promise.all([
    Promise.resolve(settingChecks()),
    Promise.resolve(environmentChecks()),
    platformChecks(),
    databaseChecks(),
    simproChecks(),
    storageChecks(),
  ]);

  const checks = groups.flat();
  const summary: Record<CheckStatus, number> = { pass: 0, warn: 0, fail: 0 };
  for (const check of checks) summary[check.status] += 1;

  return {
    ranAt: new Date().toISOString(),
    ms: Date.now() - started,
    summary,
    // Warnings are expected: an optional column nobody has added is not a fault.
    ok: summary.fail === 0,
    checks,
  };
}

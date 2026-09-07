import "server-only";

/**
 * Which environment each integration points at, and whether that combination
 * is safe to write to.
 *
 * The risk this exists for is concrete and current: SIMPRO_BASE_URL points at
 * qa-remaxdoors while the database can point at production M1. Raising an NCR
 * in that state writes a real quality record in M1 and a task into a test
 * Simpro that nobody reads — the NCR looks actioned and is not.
 *
 * Environments are declared, never inferred. Guessing from a hostname would be
 * wrong the first time a host is renamed, and wrong silently.
 */

export type Environment = "development" | "staging" | "production" | "unknown";

const VALUES: Environment[] = ["development", "staging", "production"];

function read(name: string): Environment {
  const value = (process.env[name] ?? "").trim().toLowerCase();
  return (VALUES as string[]).includes(value) ? (value as Environment) : "unknown";
}

export type EnvironmentState = {
  app: Environment;
  m1: Environment;
  simpro: Environment;
  writesAllowed: boolean;
  reason: string;
};

/**
 * Writes are blocked when M1 and Simpro disagree about which world they are
 * in, and one of them is production.
 *
 * "unknown" is deliberately permissive: this is being introduced to an app
 * already in use, and refusing every write until three new settings exist
 * would take the app down rather than make it safer. The system check reports
 * unknown loudly instead.
 */
export function environmentState(): EnvironmentState {
  const app = read("APP_ENVIRONMENT");
  const m1 = read("M1_ENVIRONMENT");
  const simpro = read("SIMPRO_ENVIRONMENT");

  if (m1 === "unknown" || simpro === "unknown") {
    return {
      app,
      m1,
      simpro,
      writesAllowed: true,
      reason:
        "M1_ENVIRONMENT and SIMPRO_ENVIRONMENT are not both set, so the combination cannot be checked. Set them to development, staging or production.",
    };
  }

  if (m1 === "production" && simpro !== "production") {
    return {
      app,
      m1,
      simpro,
      writesAllowed: false,
      reason: `M1 is production but Simpro is ${simpro}. A real NCR would be raised against a Simpro job nobody is watching, so writes are blocked.`,
    };
  }

  if (simpro === "production" && m1 !== "production") {
    return {
      app,
      m1,
      simpro,
      writesAllowed: false,
      reason: `Simpro is production but M1 is ${m1}. A test NCR would raise a real task for a technician, so writes are blocked.`,
    };
  }

  return {
    app,
    m1,
    simpro,
    writesAllowed: true,
    reason: `M1 and Simpro are both ${m1}.`,
  };
}

/** Thrown by write paths when the environments do not agree. */
export class EnvironmentMismatchError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "EnvironmentMismatchError";
  }
}

/** Call at the top of any operation that writes to M1 or Simpro. */
export function assertWritesAllowed() {
  const state = environmentState();
  if (!state.writesAllowed) throw new EnvironmentMismatchError(state.reason);
}

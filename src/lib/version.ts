import pkg from "../../package.json";

/**
 * What build is this.
 *
 * The first question in any UAT report is "which version were you on", and the
 * second is "is that the one I deployed". Neither can be answered from a
 * screenshot unless the app says so itself.
 *
 * The version is read from package.json rather than duplicated here, so
 * `npm version` remains the only place it is set. The commit and build time are
 * injected by CI — they cannot be derived at runtime, because the deployed
 * artifact has no .git directory.
 *
 * NEXT_PUBLIC_ is deliberate: those are substituted at build time and travel
 * inside the bundle. A plain process.env read would be evaluated on App
 * Service, where the build-time values do not exist, and would always be null.
 */
export const APP_NAME = "Operation Help";

export const APP_VERSION: string = pkg.version;

/** Short commit SHA the artifact was built from, when CI supplied one. */
export const BUILD_COMMIT: string | null =
  process.env.NEXT_PUBLIC_BUILD_COMMIT || null;

/** ISO timestamp of the build, when CI supplied one. */
export const BUILD_TIME: string | null =
  process.env.NEXT_PUBLIC_BUILD_TIME || null;

/**
 * One line for a bug report: "1.0.0-uat.1 (a1b2c3d)".
 *
 * Falls back to just the version when run outside CI, which is honest — a local
 * build genuinely has no commit attached, and inventing one would make a
 * developer's laptop indistinguishable from a release.
 */
export function versionLabel(): string {
  return BUILD_COMMIT ? `${APP_VERSION} (${BUILD_COMMIT})` : APP_VERSION;
}

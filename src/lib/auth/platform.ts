/**
 * Whether the x-ms-client-principal-* headers can be believed.
 *
 * This is the load-bearing assumption behind moving App Service Authentication
 * to "allow unauthenticated access". Those headers are plain HTTP headers: if
 * nothing strips them, any client can send
 *
 *     X-MS-CLIENT-PRINCIPAL-NAME: someone.else@remaxdoors.com
 *
 * and the app would believe it. What makes trusting them safe is that App
 * Service Authentication *removes* inbound headers with those names from every
 * external request and re-adds them itself only for a session it authenticated.
 * That stripping happens whenever the feature is enabled — it is not the
 * "require authentication" setting that provides it.
 *
 * So the setting we are changing does not affect spoofing. What would is
 * someone disabling the identity provider altogether: the stripping stops, and
 * the app keeps trusting the headers. This module is the guard against that.
 *
 * App Service sets WEBSITE_AUTH_ENABLED when the feature is on. Reading it
 * costs nothing and turns a silent authentication bypass into a visible fault.
 */

export type IdentityTrust = {
  trusted: boolean;
  /** "verified" | "unverified" | "disabled" | "not-app-service" */
  basis: "verified" | "unverified" | "disabled" | "not-app-service";
  detail: string;
};

/** True when running on App Service, where the platform owns sign-in. */
export function onAppService() {
  return Boolean(process.env.WEBSITE_SITE_NAME);
}

export function identityTrust(): IdentityTrust {
  if (!onAppService()) {
    return {
      trusted: false,
      basis: "not-app-service",
      detail:
        "Not running on App Service, so no platform identity exists. Local development uses AUTH_DEV_BYPASS.",
    };
  }

  const flag = (process.env.WEBSITE_AUTH_ENABLED ?? "").trim().toLowerCase();

  if (flag === "true") {
    return {
      trusted: true,
      basis: "verified",
      detail:
        "App Service Authentication is enabled, so inbound identity headers are stripped and re-issued by the platform.",
    };
  }

  if (flag === "false" || flag === "0") {
    // Fail closed. With the feature off nothing strips the headers, so
    // believing them would let anyone claim any identity. Locking everyone out
    // is the correct direction to fail.
    return {
      trusted: false,
      basis: "disabled",
      detail:
        "App Service Authentication is switched off, so identity headers could be sent by anyone. They are being ignored.",
    };
  }

  /**
   * The flag is absent. Older and newer versions of the feature have not
   * always set it, so treating absence as "off" risks locking out a working
   * deployment for a reason that is not actually true. Headers are trusted,
   * and the system check reports this as unverified so it is visible rather
   * than assumed.
   */
  return {
    trusted: true,
    basis: "unverified",
    detail:
      "WEBSITE_AUTH_ENABLED is not set, so whether the platform is stripping inbound identity headers could not be confirmed. Verify the identity provider is configured.",
  };
}

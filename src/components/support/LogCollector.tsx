"use client";

import { useEffect } from "react";
import { installGlobalLogging } from "@/lib/support/sessionLog";

/**
 * Starts recording script errors and unhandled rejections for the Support page.
 *
 * Its own component so the app shell can stay a server component: this is the
 * only part that needs to run in the browser, and it renders nothing.
 */
export function LogCollector() {
  useEffect(installGlobalLogging, []);
  return null;
}

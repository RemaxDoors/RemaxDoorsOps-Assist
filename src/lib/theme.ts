/**
 * Light, dark, or whatever the operating system says.
 *
 * Kept out of the component so the inline script in the root layout and the
 * toggle agree on the storage key and the attribute — a mismatch there shows
 * up as a flash of the wrong theme on every page load, which is exactly the
 * bug this arrangement exists to avoid.
 */

export const THEME_STORAGE_KEY = "ops_theme";

export type ThemeChoice = "light" | "dark" | "system";

export const THEME_CHOICES: ThemeChoice[] = ["light", "dark", "system"];

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as string[]).includes(value);
}

/**
 * Runs before the first paint, inlined in <head>.
 *
 * Written as a string rather than imported because it has to execute before
 * React hydrates. Anything later means the page paints light, then flips —
 * and on a dark-adapted screen in a plant room that flash is genuinely
 * unpleasant.
 *
 * Reading storage can throw in a private window, so the whole thing is inside
 * a try/catch: failing to a light theme is fine, failing to a blank page is
 * not.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`.trim();

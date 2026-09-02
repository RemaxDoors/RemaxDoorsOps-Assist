/**
 * Plain text to the RTF flavour M1 stores.
 *
 * M1 keeps every long field twice: a plain `...Text` column and a `...RTF`
 * one. All 554 existing corrective actions populate both, and M1 back-fills
 * the RTF when a record is opened in its client. Writing only the text leaves
 * our records looking different from every other row until someone opens them,
 * so the app writes both.
 *
 * Deliberately minimal: one font, one size, no styling. The app offers a plain
 * textarea, so there is no formatting to preserve — the goal is a document M1
 * renders identically to what the user typed.
 */

const BACKSLASH = String.fromCharCode(92);

const HEADER =
  BACKSLASH +
  "rtf1" +
  BACKSLASH +
  "ansi" +
  BACKSLASH +
  "ansicpg1252" +
  BACKSLASH +
  "deff0" +
  BACKSLASH +
  "deflang1033";

const FONT_TABLE =
  "{" +
  BACKSLASH +
  "fonttbl{" +
  BACKSLASH +
  "f0" +
  BACKSLASH +
  "fnil" +
  BACKSLASH +
  "fcharset0 Tahoma;}}";

const BODY_START =
  BACKSLASH +
  "viewkind4" +
  BACKSLASH +
  "uc1" +
  BACKSLASH +
  "pard" +
  BACKSLASH +
  "f0" +
  BACKSLASH +
  "fs20 ";

const PARAGRAPH = BACKSLASH + "par\r\n";

/** Escapes RTF's three control characters and anything outside ASCII. */
function escape(text: string): string {
  return [...text]
    .map((char) => {
      if (char === BACKSLASH) return BACKSLASH + BACKSLASH;
      if (char === "{") return BACKSLASH + "{";
      if (char === "}") return BACKSLASH + "}";
      if (char === "\r") return "";
      if (char === "\n") return PARAGRAPH;
      if (char === "\t") return BACKSLASH + "tab ";

      const code = char.codePointAt(0) ?? 0;
      if (code < 128) return char;

      // \uN takes a signed 16-bit value and must be followed by a fallback
      // character for readers that do not understand it.
      const signed = code > 32767 ? code - 65536 : code;
      return BACKSLASH + "u" + signed + "?";
    })
    .join("");
}

export function toRtf(text: string): string {
  const body = escape(text.trim());
  return `{${HEADER}${FONT_TABLE}\r\n${BODY_START}${body}${PARAGRAPH}}\r\n`;
}

import type { Employee } from "@/lib/repositories/employee.repo";

/**
 * Shortcuts for the two fields a tech types into most.
 *
 * Kept here rather than in the wizard so the wording can change without
 * touching form logic, and so there is one place to look when the workshop
 * asks for another one.
 */

/**
 * Description starters.
 *
 * Each one is a lead-in with the specifics left as [bracketed] prompts, not a
 * finished sentence. A chip that inserted the whole thing would let an NCR read
 * "Missing parts" and stop — past the 10-character minimum and useless to
 * whoever reads it in M1 next month. The brackets save the typing and still ask
 * for the detail that makes the record worth keeping.
 */
export const DESCRIPTION_QUICK_PICKS = [
  { label: "Missing parts", text: "Missing parts: [part and quantity]." },
  {
    label: "Damaged parts",
    text: "Damaged parts: [part, damage and location].",
  },
  {
    label: "Wrong product",
    text: "Incorrect product supplied: [received] instead of [required].",
  },
  {
    label: "Incorrect size",
    text: "Dimension mismatch: [actual measurement] versus [required measurement].",
  },
  {
    label: "Door alignment",
    text: "Door alignment issue: [location and observed issue].",
  },
  {
    label: "Opening / closing",
    text: "Door does not open or close correctly: [what happens and when].",
  },
  {
    label: "Motor fault",
    text: "Motor fault: [symptom and fault code, if shown].",
  },
  {
    label: "Controls / sensor",
    text: "Control or sensor issue: [component and observed behaviour].",
  },
  {
    label: "Fixings / brackets",
    text: "Fixing or bracket issue: [location and defect].",
  },
  {
    label: "Seal / gap",
    text: "Seal or gap issue: [location and measured gap, if available].",
  },
  {
    label: "Finish damage",
    text: "Finish damage: [scratch, dent or coating defect and location].",
  },
  {
    label: "Site not ready",
    text: "Installation blocked by site condition: [condition and work affected].",
  },
  {
    label: "Drawing mismatch",
    text: "Installation differs from approved drawing: [drawing reference and difference].",
  },
  {
    label: "Supplier issue",
    text: "Supplier-related issue: [item and observed discrepancy].",
  },
] as const;

/**
 * Assignee shortcuts, as names — never employee ids.
 *
 * `assignedTo` has to hold an M1 employee id. Hard-coding ids here would let a
 * typo write a value M1 does not recognise, and nothing would catch it until a
 * supervisor wondered why an NCR was assigned to nobody. These names are
 * matched against the employee list M1 returned for this page instead, so a
 * chip appears only when the person is really in M1 and still current, and
 * disappears by itself when they leave.
 */
export const ASSIGNEE_QUICK_PICKS = [
  "David Chua",
  "Tim Fitz",
  "Adrian",
  "Davy",
  "Harry",
  "Damian",
  "Kristian",
  "Mark",
] as const;

export type AssigneeQuickPick = { label: string; id: string };

const normalise = (value: string) => value.trim().toLowerCase();

/**
 * Resolves the names above to M1 employee ids.
 *
 * A single-word pick matches on first name, which is how the workshop refers to
 * each other. Two people sharing that first name makes the pick ambiguous, so
 * it is dropped rather than guessed — a shortcut that assigns work to the wrong
 * Damian is worse than no shortcut. Anything unmatched is dropped the same way.
 */
export function resolveAssigneeQuickPicks(
  employees: Employee[],
): AssigneeQuickPick[] {
  return ASSIGNEE_QUICK_PICKS.flatMap((pick) => {
    const wanted = normalise(pick);

    const matches = employees.filter((employee) => {
      const name = normalise(employee.name);
      if (name === wanted) return true;
      // Single-word pick: compare against the first name only, so "Mark" does
      // not also match "Damian Markovic".
      if (!wanted.includes(" ")) return name.split(/\s+/)[0] === wanted;
      return name.startsWith(`${wanted} `);
    });

    return matches.length === 1
      ? [{ label: pick, id: matches[0]!.id }]
      : [];
  });
}

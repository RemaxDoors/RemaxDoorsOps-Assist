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
 * Assignee shortcuts, by team.
 *
 * Two rules here, both deliberate.
 *
 * These are search keys, not labels. `assignedTo` has to hold an M1 employee
 * id, and hard-coding ids would let one typo write a value M1 does not
 * recognise, with nothing to catch it until a supervisor wondered why an NCR
 * was assigned to nobody. Each key is matched against the employee list M1
 * returned for the page instead.
 *
 * And the chip shows the name M1 holds, not the key. That is how a one-word key
 * still puts a full name on screen — "Nicole" finds the row and the button then
 * reads whatever M1 calls her. Nobody has to invent a surname to make the
 * shortcut read properly, and if M1 is corrected the chip follows.
 *
 * A key that matches nobody, or more than one current employee, is dropped: a
 * shortcut that assigns work to the wrong person is worse than no shortcut.
 */
export const ASSIGNEE_TEAMS = [
  {
    team: "Engineering",
    // "Tim Fitz" rather than the full surname on purpose: the key is matched as
    // a prefix, so it survives a spelling difference between here and M1.
    names: ["David Chua", "Tim Fitz", "Hamish", "Eamon Galvin"],
  },
  {
    team: "Project",
    names: ["Nicole", "Andrew Butcher", "Ivy", "Hanna Ward", "Danielle Dines"],
  },
  {
    team: "Planning",
    names: ["Liliarna", "Martin", "Mikayla"],
  },
  {
    team: "Warehouse, operations and production",
    names: ["Daniel Zegelin", "Thain Voss"],
  },
  {
    team: "Program services",
    names: ["Danica Sangster", "Kellie Morse"],
  },
  {
    team: "Sales",
    names: ["Roy Young"],
  },
  {
    team: "Hub managers",
    names: ["Davy Wouters", "Kevin Shelton"],
  },
  {
    team: "Field service",
    // One person, not Adrian and Simon.
    names: ["Adrian Simon"],
  },
  {
    team: "Executive",
    names: ["Damian", "Harrison", "Kristian", "Rovi", "Colin", "Mark"],
  },
] as const;

export type AssigneeQuickPick = { label: string; id: string };

export type AssigneeTeam = { team: string; picks: AssigneeQuickPick[] };

const normalise = (value: string) => value.trim().toLowerCase();

/**
 * Resolves each key to exactly one current M1 employee, and labels the chip
 * with that employee's own name.
 *
 * A single-word key is compared against the first name only, so "Mark" does not
 * also match "Damian Markovic" and "Daniel" does not match "Danielle". A
 * multi-word key is a prefix, so "Tim Fitz" still finds "Tim Fitzpatrick".
 * Teams left with nobody are dropped rather than rendered empty.
 */
export function resolveAssigneeTeams(employees: Employee[]): AssigneeTeam[] {
  return ASSIGNEE_TEAMS.map((group) => ({
    team: group.team,
    picks: group.names.flatMap((key) => {
      const wanted = normalise(key);

      const matches = employees.filter((employee) => {
        const name = normalise(employee.name);
        if (name === wanted) return true;
        if (!wanted.includes(" ")) return name.split(/\s+/)[0] === wanted;
        return name.startsWith(wanted);
      });

      // The label is M1's name, not the key: that is what puts a full name on
      // the button.
      return matches.length === 1
        ? [{ label: matches[0]!.name, id: matches[0]!.id }]
        : [];
    }),
  })).filter((group) => group.picks.length > 0);
}

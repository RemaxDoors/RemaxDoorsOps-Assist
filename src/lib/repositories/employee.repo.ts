import "server-only";
import { readRows } from "@/lib/db/gateway";

export type Employee = {
  id: string;
  name: string;
  email: string | null;
};

/**
 * Belt and braces on top of the termination date: some records are marked
 * only by appending "- INACTIVE" to the name. Today every such record also
 * has a termination date, but a rename without a date would slip through.
 */
const NAMED_INACTIVE = /INACTIVE/i;

/**
 * Staff list for the "reported by" and "assigned to" pickers.
 *
 * Leavers are excluded on lmeTerminationDate — of 174 employees, 78 have one
 * and only 68 carry the "- INACTIVE" name marker, so filtering on the name
 * alone left 10 former staff pickable.
 *
 * The list is small enough (under 200 rows) that filtering here rather than in
 * SQL costs nothing and keeps the query inside the single-table gateway.
 */
export async function listEmployees(): Promise<Employee[]> {
  const rows = await readRows<Record<string, unknown>>("employee", {
    columns: [
      "lmeEmployeeID",
      "lmeEmployeeName",
      "lmeWorkEmailAddress",
      "lmeTerminationDate",
    ],
    orderBy: { column: "lmeEmployeeName", direction: "asc" },
  });

  return rows
    .filter((row) => row.lmeTerminationDate == null)
    .map((row) => ({
      id: String(row.lmeEmployeeID ?? "").trim(),
      name: String(row.lmeEmployeeName ?? "").trim(),
      email: String(row.lmeWorkEmailAddress ?? "").trim() || null,
    }))
    .filter(
      (employee) =>
        employee.id.length > 0 &&
        employee.name.length > 0 &&
        !NAMED_INACTIVE.test(employee.name),
    );
}

/**
 * Every employee id mapped to a name, leavers included.
 *
 * listEmployees() deliberately hides terminated staff so nobody can be assigned
 * new work, but old NCRs still carry their ids — without them the charts would
 * show bare codes like "DJZ".
 */
export async function employeeNameMap(): Promise<Map<string, string>> {
  const rows = await readRows<Record<string, unknown>>("employee", {
    columns: ["lmeEmployeeID", "lmeEmployeeName"],
  });

  return new Map(
    rows
      .map(
        (row) =>
          [
            String(row.lmeEmployeeID ?? "").trim(),
            String(row.lmeEmployeeName ?? "")
              .trim()
              .replace(/\s*-\s*INACTIVE\s*$/i, ""),
          ] as const,
      )
      .filter(([id, name]) => id.length > 0 && name.length > 0),
  );
}

/**
 * The M1 employee behind a signed-in Entra account.
 *
 * Entra and M1 share no identifier, so the work email is the join. It is the
 * only field both systems hold for the same person, and M1 fills it in for
 * staff who have a mailbox. Matching is case-insensitive because M1 records
 * are typed by hand and Entra normalises to lower case.
 *
 * Falls back to an exact name match, which covers workshop staff who have an
 * M1 record but no email against it. Returns null rather than guessing when
 * neither matches — a wrong default would quietly attribute someone else's
 * NCR to the wrong person.
 */
export async function findEmployeeForUser({
  email,
  name,
}: {
  email?: string | null;
  name?: string | null;
}): Promise<Employee | null> {
  const employees = await listEmployees();

  const wanted = (email ?? "").trim().toLowerCase();
  if (wanted) {
    const byEmail = employees.find(
      (employee) => (employee.email ?? "").trim().toLowerCase() === wanted,
    );
    if (byEmail) return byEmail;
  }

  const wantedName = (name ?? "").trim().toLowerCase();
  if (wantedName) {
    const byName = employees.find(
      (employee) => employee.name.trim().toLowerCase() === wantedName,
    );
    if (byName) return byName;
  }

  return null;
}

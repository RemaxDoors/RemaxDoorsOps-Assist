import "server-only";

/**
 * Simpro REST wrapper.
 *
 * The transport, auth and error handling below are done. What is still open is
 * the shape of *your* Simpro build: the company id, which fields on a job map
 * onto an NCR, and how tasks/todos are represented in your account. Those are
 * marked TODO and are the only places that should need editing.
 */

export type SimproAssigneeType = "engineering" | "project-manager";

/** Simpro splits work into Service jobs and Project jobs. */
export type SimproJobType = "service" | "project";

export function isSimproConfigured() {
  return Boolean(
    process.env.SIMPRO_BASE_URL &&
      process.env.SIMPRO_API_TOKEN &&
      resolveCompanyId(process.env.SIMPRO_BASE_URL),
  );
}

/**
 * Which Simpro company to talk to.
 *
 * Prefers SIMPRO_COMPANY_ID. Falls back to a company in the base URL, because
 * ".../api/v1.0/companies/4" is a natural thing to paste there and silently
 * ignoring it produced requests to company 0 — which Simpro rejects with
 * "Cannot access jobs for company 0 in multi-company builds", an error that
 * names neither the setting at fault nor the app that sent it.
 *
 * Returns null when neither says, so the caller can fail with a message that
 * does name the setting.
 */
function resolveCompanyId(baseUrl: string | undefined): string | null {
  const explicit = (process.env.SIMPRO_COMPANY_ID ?? "").trim();
  if (explicit && explicit !== "0") return explicit;

  const fromUrl = baseUrl?.match(/\/companies\/(\d+)/)?.[1];
  return fromUrl && fromUrl !== "0" ? fromUrl : null;
}

/**
 * The Simpro host, with any path discarded.
 *
 * SIMPRO_BASE_URL is meant to be the bare host, because this module builds
 * `/api/v1.0/companies/{id}/...` itself and reads the company from
 * SIMPRO_COMPANY_ID. People reasonably paste the full API root instead —
 * ".../api/v1.0/companies/4" — and every request path here starts with "/",
 * so that extra path was silently ignored rather than breaking anything.
 * Reducing to the origin makes both forms behave the same on purpose, and
 * keeps the company id in one place instead of two that can disagree.
 */
function origin(baseUrl: string) {
  return new URL(baseUrl).origin;
}

function requireConfig() {
  const baseUrl = process.env.SIMPRO_BASE_URL;
  const token = process.env.SIMPRO_API_TOKEN;
  if (!baseUrl || !token) {
    throw new Error(
      "Simpro is not configured — set SIMPRO_BASE_URL and SIMPRO_API_TOKEN in .env.local",
    );
  }

  let host: string;
  try {
    host = origin(baseUrl);
  } catch {
    throw new Error(
      `SIMPRO_BASE_URL is not a valid URL: ${baseUrl}. Use the host, e.g. https://qa-remaxdoors.simprosuite.com`,
    );
  }

  const companyId = resolveCompanyId(baseUrl);
  if (!companyId) {
    throw new Error(
      "SIMPRO_COMPANY_ID is not set. Simpro is a multi-company build, so " +
        "every request needs one (Melbourne is 4).",
    );
  }

  return { baseUrl: host, token, companyId };
}

async function simpro<T>(
  path: string,
  init: { method?: string; body?: unknown; searchParams?: Record<string, string> } = {},
): Promise<T> {
  const { baseUrl, token } = requireConfig();
  const url = new URL(`/api/v1.0/${path.replace(/^\/+/, "")}`, baseUrl);
  for (const [key, value] of Object.entries(init.searchParams ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new SimproError(
      `Simpro ${init.method ?? "GET"} ${path} failed (${response.status}): ${detail.slice(0, 300)}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

/** Carries the HTTP status so callers can say something useful about it. */
export class SimproError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SimproError";
  }
}

/**
 * Turns a Simpro failure into something a person on the floor can act on.
 *
 * The raw text is written for us, not for them: "Cannot access jobs for
 * company 0 in multi-company builds" names neither the setting at fault nor
 * anything a tech could do about it. Every branch here ends with a way to
 * keep going, because an NCR can always be raised without a job — losing the
 * report is worse than losing the Simpro link.
 *
 * Callers should log the original before calling this; nothing here is
 * detailed enough to debug from.
 */
export function describeSimproError(error: unknown, subject = "That job"): string {
  const fallback =
    "Could not reach Simpro. Try again, or raise the NCR without a job.";

  if (!(error instanceof SimproError)) {
    // Configuration faults (missing token, company or base URL) land here.
    return "Simpro is not set up correctly, so lookups are unavailable. Raise the NCR without a job and let IT know.";
  }

  if (error.status === 404) {
    return `${subject} was not found in Simpro. Check the number — note that the test system holds only some jobs.`;
  }
  if (error.status === 401 || error.status === 403) {
    return "Simpro refused the connection. Raise the NCR without a job and let IT know.";
  }
  if (error.status === 422 || error.status === 400) {
    return "Simpro would not accept that request. Raise the NCR without a job and let IT know.";
  }
  if (error.status === 429) {
    return "Simpro is busy. Wait a moment and try again.";
  }
  if (error.status >= 500) {
    return "Simpro is not responding. Try again shortly, or raise the NCR without a job.";
  }
  return fallback;
}

/** The subset of a Simpro job the NCR wizard prefills from. */
export type SimproJobSummary = {
  jobId: string;
  name: string;
  type: SimproJobType | null;
  customer: string | null;
  customerId: number | null;
  site: string | null;
  siteId: number | null;
  stage: string | null;
  status: string | null;
  orderNo: string | null;
  projectManager: string | null;
  projectManagerId: number | null;
  /** From the job's custom fields — the M1 sales order this job maps to. */
  m1SalesOrderNumber: string | null;
  m1QuoteNumber: string | null;
};

type SimproCustomField = {
  CustomField?: { Name?: string };
  Value?: string | null;
};

type SimproJobResponse = {
  ID?: number | string;
  Name?: string;
  Type?: string;
  Stage?: string;
  Status?: { Name?: string };
  OrderNo?: string;
  Customer?: {
    ID?: number;
    CompanyName?: string;
    GivenName?: string;
    FamilyName?: string;
  };
  Site?: { ID?: number; Name?: string };
  ProjectManager?: { ID?: number; Name?: string };
  CustomFields?: SimproCustomField[];
};

/** Reads one of the job's custom fields by name, trimmed, or null. */
function customField(job: SimproJobResponse, name: string): string | null {
  const match = job.CustomFields?.find(
    (entry) => entry.CustomField?.Name?.trim().toLowerCase() === name.toLowerCase(),
  );
  const value = match?.Value?.trim();
  return value ? value : null;
}

/**
 * Fetches one job for prefill. Field names verified against QA job 605929.
 * Simpro reports Service vs Project on the job itself, so the wizard does not
 * have to ask.
 */
export async function fetchSimproJob(jobId: string): Promise<SimproJobSummary> {
  const { companyId } = requireConfig();
  const job = await simpro<SimproJobResponse>(
    `companies/${companyId}/jobs/${encodeURIComponent(jobId)}`,
  );

  const customer = job.Customer;
  const customerName =
    customer?.CompanyName ??
    [customer?.GivenName, customer?.FamilyName].filter(Boolean).join(" ") ??
    null;

  return {
    jobId: String(job.ID ?? jobId),
    name: job.Name?.trim() ?? "",
    type: job.Type?.toLowerCase() === "service" ? "service" : "project",
    customer: customerName || null,
    customerId: job.Customer?.ID ?? null,
    site: job.Site?.Name ?? null,
    siteId: job.Site?.ID ?? null,
    stage: job.Stage ?? null,
    status: job.Status?.Name ?? null,
    orderNo: job.OrderNo?.trim() || null,
    projectManager: job.ProjectManager?.Name ?? null,
    projectManagerId: job.ProjectManager?.ID ?? null,
    m1SalesOrderNumber: customField(job, "M1SalesOrderNumber"),
    m1QuoteNumber: customField(job, "M1QuoteNumber"),
  };
}

/** Cheap round trip used by the health check. */
export async function pingSimpro(): Promise<boolean> {
  const { companyId } = requireConfig();
  await simpro<unknown[]>(`companies/${companyId}/employees/`, {
    searchParams: { columns: "ID", pageSize: "1" },
  });
  return true;
}

export type SimproStaff = { id: number; name: string };

/** Staff who can be assigned a task. */
export async function listSimproStaff(): Promise<SimproStaff[]> {
  const { companyId } = requireConfig();
  const rows = await simpro<{ ID?: number; Name?: string }[]>(
    `companies/${companyId}/employees/`,
    { searchParams: { columns: "ID,Name", pageSize: "250" } },
  );
  return rows
    .filter((r) => r.ID != null && r.Name)
    .map((r) => ({ id: Number(r.ID), name: String(r.Name).trim() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const SIMPRO_TASK_PRIORITIES = ["Low", "Medium", "High"] as const;
export const SIMPRO_TASK_STATUSES = ["Pending", "In Progress", "Complete"] as const;

export type SimproTaskInput = {
  subject: string;
  description: string;
  assignedToId: number;
  priority: string;
  status: string;
  /** ISO date (yyyy-mm-dd). */
  dueDate?: string | null;
  jobId?: string | null;
  customerId?: number | null;
  siteId?: number | null;
  emailNotifications?: boolean;
};

/**
 * Raises a Simpro task so the assignee knows an NCR was created.
 * Field names follow the task resource as returned by this account.
 */
/**
 * Adds a note to a Simpro job. Notes carry a Reference back to the job, which
 * is how an NCR gets linked on the job side — tasks cannot be attached to a
 * job through the API (see createSimproTask).
 */
export async function addSimproJobNote({
  jobId,
  subject,
  note,
}: {
  jobId: string;
  subject: string;
  note: string;
}): Promise<{ noteId: string }> {
  const { companyId } = requireConfig();
  const created = await simpro<{ ID?: number | string }>(
    `companies/${companyId}/jobs/${encodeURIComponent(jobId)}/notes/`,
    { method: "POST", body: { Subject: subject.slice(0, 255), Note: note } },
  );
  return { noteId: String(created.ID ?? "") };
}

export async function createSimproTask(
  input: SimproTaskInput,
): Promise<{ taskId: string; url: string; jobNoteId: string | null; jobNoteError: string | null }> {
  const { baseUrl, companyId } = requireConfig();

  const body: Record<string, unknown> = {
    Subject: input.subject.slice(0, 255),
    Description: input.description,
    AssignedTo: input.assignedToId,
    Status: input.status,
    Priority: input.priority,
    EmailNotifications: input.emailNotifications ?? true,
  };
  if (input.dueDate) body.DueDate = input.dueDate;

  /**
   * Customer, site and job fill in the same fields a person would see on
   * Simpro's Create Task screen.
   *
   * Job must be an object — `{ Job: 605929 }` is refused with "This API
   * Column does not allow POST requests", which reads like the field is
   * closed to the API when it is really the shape that is wrong. Customer
   * and Site accept a bare id, so the inconsistency is easy to walk into.
   */
  const associated: Record<string, unknown> = {};
  if (input.customerId) associated.Customer = input.customerId;
  if (input.siteId) associated.Site = input.siteId;

  const jobNumber = Number(input.jobId);
  if (input.jobId && Number.isInteger(jobNumber) && jobNumber > 0) {
    associated.Job = { ID: jobNumber };
  }
  if (Object.keys(associated).length > 0) body.Associated = associated;

  const created = await simpro<{ ID?: number | string }>(
    `companies/${companyId}/tasks/`,
    { method: "POST", body },
  );

  const taskId = String(created.ID ?? "");

  /**
   * The job note was a stand-in for a link the API was thought to refuse.
   * Now that Associated.Job is set on the task itself, the task appears
   * under the job's Tasks tab and the note would only be duplication.
   */
  const jobNoteId: string | null = null;
  const jobNoteError: string | null = null;

  return {
    taskId,
    url: new URL(`/staff/taskDetails.php?id=${taskId}`, baseUrl).toString(),
    jobNoteId,
    jobNoteError,
  };
}

/** A catalogue line sitting on a job's cost centre. */
export type SimproJobPart = {
  partNumber: string;
  description: string;
  quantity: number;
  costCentre: string | null;
};

type SimproSection = { ID?: number };
type SimproCostCentre = {
  ID?: number;
  Name?: string;
  CostCenter?: { Name?: string };
};
type SimproCatalogLine = {
  Catalog?: { PartNo?: string; Name?: string };
  Total?: { Qty?: number };
};

/**
 * Lists the parts booked to a Simpro job, walking sections → cost centres →
 * catalogue lines, so the wizard can offer real part numbers instead of making
 * someone type one. Shape verified against QA job 605929.
 */
export async function listSimproJobParts(
  jobId: string,
): Promise<SimproJobPart[]> {
  const { companyId } = requireConfig();
  const base = `companies/${companyId}/jobs/${encodeURIComponent(jobId)}`;

  const sections = await simpro<SimproSection[]>(`${base}/sections/`);
  const parts: SimproJobPart[] = [];

  for (const section of sections) {
    if (section.ID == null) continue;
    const centres = await simpro<SimproCostCentre[]>(
      `${base}/sections/${section.ID}/costCenters/`,
    );

    for (const centre of centres) {
      if (centre.ID == null) continue;

      const lines = await simpro<SimproCatalogLine[]>(
        `${base}/sections/${section.ID}/costCenters/${centre.ID}/catalogs/`,
      );

      for (const line of lines) {
        const partNumber = line.Catalog?.PartNo?.trim();
        if (!partNumber) continue;
        parts.push({
          partNumber,
          description: line.Catalog?.Name?.trim() ?? "",
          quantity: Number(line.Total?.Qty ?? 0),
          costCentre: centre.CostCenter?.Name?.trim() ?? centre.Name?.trim() ?? null,
        });
      }
    }
  }

  return parts;
}

/**
 * The Simpro job's own page. Stored in M1's ucmaSimproLink so that opening an
 * attachment from M1 lands on the job, where the NCR folder lives.
 *
 * Simpro's API exposes no UI URL, so the path comes from
 * SIMPRO_JOB_URL_TEMPLATE ({jobId} placeholder) and can be corrected without
 * a code change.
 */
export function simproJobUrl(jobId: string): string {
  const { baseUrl } = requireConfig();
  const template =
    process.env.SIMPRO_JOB_URL_TEMPLATE ?? "/staff/projectJob.php?jobID={jobId}";
  return new URL(
    template.replace("{jobId}", encodeURIComponent(jobId)),
    baseUrl,
  ).toString();
}

/**
 * Uploads a file into a per-NCR folder on a Simpro job, and returns the link
 * to the job for storing against the attachment in M1.
 */
export async function uploadSimproJobAttachment({
  jobId,
  ncrId,
  filename,
  contents,
}: {
  jobId: string;
  ncrId: string;
  filename: string;
  contents: Buffer;
}): Promise<{
  url: string;
  fileId: string;
  folderId: string;
  folderName: string;
}> {
  const { companyId } = requireConfig();
  const base = `companies/${companyId}/jobs/${encodeURIComponent(jobId)}/attachments`;
  const folderName = `NCR ${ncrId}`;

  // Reuse the NCR's folder if a previous upload already made it.
  const existing = await simpro<{ ID?: number | string; Name?: string }[]>(
    `${base}/folders/`,
  );
  const match = existing.find((f) => f.Name?.trim() === folderName);

  const folder =
    match ??
    (await simpro<{ ID?: number | string }>(`${base}/folders/`, {
      method: "POST",
      body: { Name: folderName },
    }));

  const file = await simpro<{ ID?: number | string }>(`${base}/files/`, {
    method: "POST",
    body: {
      Filename: filename,
      Base64Data: contents.toString("base64"),
      Folder: folder.ID,
    },
  });

  const fileId = String(file.ID ?? "");
  const folderId = String(folder.ID ?? "");

  return { url: simproJobUrl(jobId), fileId, folderId, folderName };
}

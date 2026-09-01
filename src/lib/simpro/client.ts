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
  return Boolean(process.env.SIMPRO_BASE_URL && process.env.SIMPRO_API_TOKEN);
}

function requireConfig() {
  const baseUrl = process.env.SIMPRO_BASE_URL;
  const token = process.env.SIMPRO_API_TOKEN;
  if (!baseUrl || !token) {
    throw new Error(
      "Simpro is not configured — set SIMPRO_BASE_URL and SIMPRO_API_TOKEN in .env.local",
    );
  }
  return {
    baseUrl,
    token,
    companyId: process.env.SIMPRO_COMPANY_ID ?? "0",
  };
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
    throw new Error(
      `Simpro ${init.method ?? "GET"} ${path} failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
  return (await response.json()) as T;
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

  const description = input.jobId
    ? `${input.description}

Simpro job: ${input.jobId}`
    : input.description;

  const body: Record<string, unknown> = {
    Subject: input.subject.slice(0, 255),
    Description: description,
    AssignedTo: input.assignedToId,
    Status: input.status,
    Priority: input.priority,
    EmailNotifications: input.emailNotifications ?? true,
  };
  if (input.dueDate) body.DueDate = input.dueDate;

  /**
   * Customer and site fill in the same fields a person would see on Simpro's
   * Create Task screen.
   *
   * The job deliberately is not sent: Simpro rejects Associated/Job on both
   * POST and PATCH ("This API Column does not allow POST requests"), so
   * Project No. cannot be set through the API. The job number goes into the
   * description instead, so the link is at least visible and searchable.
   */
  const associated: Record<string, unknown> = {};
  if (input.customerId) associated.Customer = input.customerId;
  if (input.siteId) associated.Site = input.siteId;
  if (Object.keys(associated).length > 0) body.Associated = associated;

  const created = await simpro<{ ID?: number | string }>(
    `companies/${companyId}/tasks/`,
    { method: "POST", body },
  );

  const taskId = String(created.ID ?? "");

  /**
   * Simpro will not let the API attach a task to a job — Associated/Job is
   * rejected on POST and PATCH, and jobs/{id}/tasks/ is search-only. A job
   * note is the one thing that does link back, so the job shows the NCR.
   */
  let jobNoteId: string | null = null;
  let jobNoteError: string | null = null;
  if (input.jobId) {
    try {
      const note = await addSimproJobNote({
        jobId: input.jobId,
        subject: input.subject,
        note: `${input.description}

Simpro task ${taskId}.`,
      });
      jobNoteId = note.noteId;
    } catch (error) {
      jobNoteError =
        error instanceof Error ? error.message : "Job note could not be added";
    }
  }

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

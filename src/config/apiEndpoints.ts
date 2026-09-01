/**
 * The public surface of the Operation Help API, described once and used by
 * both the JSON index (/api) and the reference page (/api-docs), so the two
 * can never drift apart.
 */

export type ApiParam = {
  name: string;
  required?: boolean;
  description: string;
  example?: string;
};

export type ApiEndpoint = {
  method: "GET" | "POST";
  path: string;
  summary: string;
  description: string;
  group: "NCR" | "M1" | "Simpro" | "System";
  auth: boolean;
  params?: ApiParam[];
  /** Path used by the "Try it" button and the sample command. */
  sample: string;
  note?: string;
};

export const apiEndpoints: ApiEndpoint[] = [
  {
    method: "GET",
    path: "/api/ncr",
    summary: "List non-conformances",
    description:
      "Newest first. Returns the NCR with its category, code and cause resolved to descriptions.",
    group: "NCR",
    auth: true,
    params: [
      { name: "status", description: "Open or Closed", example: "Open" },
      { name: "category", description: "Category code", example: "FLTY" },
      {
        name: "search",
        description: "Matches NCR number, job, part or part description",
        example: "50481",
      },
      { name: "limit", description: "1-200, default 50", example: "25" },
    ],
    sample: "/api/ncr?status=Open&limit=5",
  },
  {
    method: "POST",
    path: "/api/ncr",
    summary: "Create a non-conformance",
    description:
      "Multipart form. Allocates the next NCR number, writes the record, saves any attachments and optionally raises a Simpro task.",
    group: "NCR",
    auth: true,
    params: [
      { name: "categoryId", required: true, description: "Category code", example: "FLTY" },
      {
        name: "description",
        required: true,
        description: "What went wrong (10 characters or more)",
      },
      { name: "reportedBy", required: true, description: "Employee ID", example: "DW" },
      { name: "codeId", description: "Code", example: "QA" },
      { name: "causeId", description: "Cause", example: "SUPT" },
      { name: "partId", description: "Part number" },
      { name: "partDescription", description: "Part description (50 chars)" },
      { name: "jobId", description: "M1 job number" },
      { name: "simproJobId", description: "Simpro job number" },
      { name: "quantity", description: "Quantity affected" },
      { name: "assignedTo", description: "Employee ID" },
      { name: "attachments", description: "One or more files (15MB each)" },
      { name: "createSimproTask", description: "true to raise a Simpro task" },
      {
        name: "simproAssigneeType",
        description: "engineering or project-manager",
      },
    ],
    sample: "/api/ncr",
    note: "Writes to M1. Returns the allocated NCR number plus any warnings.",
  },
  {
    method: "GET",
    path: "/api/m1/jobs",
    summary: "Search M1 jobs",
    description: "Matches job number, part number or part description. Open jobs only by default.",
    group: "M1",
    auth: true,
    params: [
      { name: "q", required: true, description: "Search term, 3 characters or more", example: "50481" },
      { name: "type", description: "service or project", example: "project" },
      { name: "includeClosed", description: "true to include closed jobs" },
    ],
    sample: "/api/m1/jobs?q=50481",
  },
  {
    method: "GET",
    path: "/api/simpro/job/{id}",
    summary: "Fetch a Simpro job",
    description:
      "Job type, customer, site, stage, status, order number and project manager.",
    group: "Simpro",
    auth: true,
    sample: "/api/simpro/job/605929",
  },
  {
    method: "GET",
    path: "/api/simpro/job/{id}/parts",
    summary: "Parts on a Simpro job",
    description: "Catalogue lines across every section and cost centre on the job.",
    group: "Simpro",
    auth: true,
    sample: "/api/simpro/job/605929/parts",
  },
  {
    method: "GET",
    path: "/api/health/db",
    summary: "Database health",
    description: "Confirms the M1 connection. No authentication required.",
    group: "System",
    auth: false,
    sample: "/api/health/db",
  },
  {
    method: "GET",
    path: "/api",
    summary: "This index, as JSON",
    description: "Machine-readable list of every endpoint.",
    group: "System",
    auth: true,
    sample: "/api",
  },
];

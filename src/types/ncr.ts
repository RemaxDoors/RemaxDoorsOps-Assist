import { z } from "zod";

/** Derived from M1's qarCorrectiveActionComplete flag. */
export const NCR_STATUSES = ["Open", "Closed"] as const;
export type NcrStatus = (typeof NCR_STATUSES)[number];

export type Lookup = { id: string; description: string };

export type Ncr = {
  id: string;
  jobId: string | null;
  partId: string | null;
  partDescription: string | null;
  category: Lookup | null;
  code: Lookup | null;
  cause: Lookup | null;
  status: NcrStatus;
  description: string;
  correctiveAction: string | null;
  correctiveActionDate: string | null;
  quantity: number;
  reportedBy: string | null;
  assignedTo: string | null;
  createdBy: string | null;
  createdAt: string;
  /** Hours spent putting it right. */
  actualHours: number;
  /** Optional M1 user-defined columns; null when the column is not installed. */
  simproJobId: string | null;
  simproTaskId: string | null;
  severity: string | null;
  /** Entra display name of whoever raised it, from uqarReportedBy. */
  reportedByName: string | null;
  additionalCost: number | null;
  additionalCostDetail: string | null;
  /** What was said back once the corrective action was recorded. */
  response: string | null;
  signedOff: boolean;
  /** M1 employee id of whoever signed it off. */
  signedOffBy: string | null;
  signedOffDate: string | null;
};

/** M1 stores severity free-text (nvarchar(10)); these are the offered values. */
export const NCR_SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

export const ncrFilterSchema = z.object({
  status: z.enum(NCR_STATUSES).optional(),
  category: z.string().trim().max(5).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type NcrFilter = z.infer<typeof ncrFilterSchema>;

/** What the Add NCR wizard collects. */
export const ncrCreateSchema = z.object({
  partId: z.string().trim().max(30).optional(),
  partDescription: z.string().trim().max(50).optional(),
  jobId: z.string().trim().max(20).optional(),
  categoryId: z.string().trim().max(5).min(1, "Pick a category"),
  codeId: z.string().trim().max(5).optional(),
  causeId: z.string().trim().max(5).optional(),
  description: z
    .string()
    .trim()
    .min(10, "Describe the non-conformance")
    .max(8000),
  quantity: z.coerce.number().min(0).max(1_000_000).default(0),
  reportedBy: z.string().trim().min(1, "Pick who reported it").max(10),
  assignedTo: z.string().trim().max(10).optional(),
  /** Simpro job the details were pulled from. uqarSimproJobID is nvarchar(10),
   *  so validating at 20 would have accepted a value the insert then trimmed. */
  simproJobId: z.string().trim().max(10).optional(),
  severity: z.enum(NCR_SEVERITIES).optional().or(z.literal("")),
  actualHours: z.coerce.number().min(0).max(999999).default(0),
  additionalCost: z.coerce.number().min(0).max(9999999999).default(0),
  additionalCostDetail: z.string().trim().max(200).optional(),
  /**
   * Job context for the description. Descriptive only — the identifiers that
   * matter (Simpro job, task, author) come from their own fields, so nothing
   * here is load-bearing if a client sends something odd.
   */
  jobName: z.string().trim().max(200).optional(),
  customer: z.string().trim().max(200).optional(),
  site: z.string().trim().max(200).optional(),
  projectManager: z.string().trim().max(120).optional(),
  m1SalesOrderNumber: z.string().trim().max(40).optional(),
  m1QuoteNumber: z.string().trim().max(40).optional(),
});

export type NcrCreateInput = z.infer<typeof ncrCreateSchema>;

/* ----------------------------------------------------------- dashboard --- */

export const PERIODS = ["day", "month", "year", "all"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  day: "today",
  month: "this month",
  year: "this year",
  all: "all time",
};

export const PERIOD_OPTIONS: Record<Period, string> = {
  day: "Today",
  month: "This month",
  year: "This year",
  all: "All time",
};

/** The three ways M1 classifies a non-conformance. */
export const DIMENSIONS = ["category", "code", "cause"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  category: "Category",
  code: "Code",
  cause: "Cause",
};

/**
 * Recording a corrective action, and optionally closing the NCR.
 *
 * Closing requires the corrective action to say something: an NCR marked
 * complete with no explanation is worse than one left open, because it looks
 * resolved and cannot be audited.
 */
export const ncrUpdateSchema = z
  .object({
    correctiveAction: z.string().trim().max(8000),
    complete: z.coerce.boolean(),
    assignedTo: z.string().trim().max(10).optional(),
    /** Free text recorded after the corrective action. */
    response: z.string().trim().max(8000).optional(),
    signedOff: z.coerce.boolean().optional(),
    signedOffBy: z.string().trim().max(20).optional(),
  })
  .refine(
    (value) => !value.complete || value.correctiveAction.trim().length >= 10,
    {
      message: "Describe the corrective action before marking it complete",
      path: ["correctiveAction"],
    },
  );

/**
 * Sign-off is deliberately independent of the corrective action.
 *
 * Two rules were enforced here and both were wrong: that signing off required
 * the corrective action to be complete, and that it required a named person.
 * Neither is how the business works — a corrective action is completed whether
 * or not anyone signs it off, and the sign-off name is not mandatory. They are
 * separate facts about the NCR, so nothing here couples them.
 */

export type NcrUpdateInput = z.infer<typeof ncrUpdateSchema>;

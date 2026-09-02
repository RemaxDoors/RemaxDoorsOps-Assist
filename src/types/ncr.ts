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
};

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
  /** Simpro job the details were pulled from, if any. */
  simproJobId: z.string().trim().max(20).optional(),
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

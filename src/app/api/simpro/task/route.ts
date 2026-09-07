import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSimproTask,
  describeSimproError,
  isSimproConfigured,
} from "@/lib/simpro/client";
import {
  getNcrSimproTaskId,
  setNcrSimproReference,
} from "@/lib/repositories/ncr.repo";

export const dynamic = "force-dynamic";

const taskSchema = z.object({
  subject: z.string().trim().min(1).max(255),
  description: z.string().trim().max(8000),
  assignedToId: z.coerce.number().int().positive(),
  priority: z.string().trim().min(1).max(30),
  status: z.string().trim().min(1).max(30),
  dueDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  jobId: z.string().trim().max(20).optional(),
  ncrId: z.string().trim().max(20).optional(),
  customerId: z.coerce.number().int().positive().optional(),
  siteId: z.coerce.number().int().positive().optional(),
  emailNotifications: z.boolean().default(true),
});

export async function POST(request: Request) {
  if (!isSimproConfigured()) {
    return NextResponse.json({ error: "Simpro is not connected, so a task cannot be raised." }, { status: 503 });
  }

  const payload = taskSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      { error: "Check the task details", issues: payload.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  /**
   * One task per NCR. Creating a second is not recoverable through this app —
   * the field holds one id — and a technician acting on the wrong one is a
   * real cost. The existing id stays the source of truth; replacing it has to
   * be a deliberate act, not a second click.
   */
  if (payload.data.ncrId) {
    const existingTaskId = await getNcrSimproTaskId(payload.data.ncrId).catch(
      () => null,
    );
    if (existingTaskId) {
      return NextResponse.json(
        {
          error: "A Simpro task has already been created for this NCR.",
          data: { existingTaskId, ncrId: payload.data.ncrId },
        },
        { status: 409 },
      );
    }
  }

  try {
    const task = await createSimproTask({
      ...payload.data,
      dueDate: payload.data.dueDate || null,
    });

    // Write the task id back onto the NCR so M1 can reference it.
    let reference: { stored: boolean; message: string | null } = {
      stored: false,
      message: null,
    };
    if (payload.data.ncrId) {
      try {
        reference = await setNcrSimproReference(payload.data.ncrId, {
          taskId: task.taskId,
          simproJobId: payload.data.jobId,
        });
      } catch (error) {
        reference = {
          stored: false,
          message:
            error instanceof Error
              ? `Could not record the task on the NCR: ${error.message}`
              : "Could not record the task on the NCR.",
        };
      }
    }

    return NextResponse.json({ data: { ...task, reference } }, { status: 201 });
  } catch (error) {
    console.error("[simpro] task creation failed:", error);
    return NextResponse.json(
      { error: describeSimproError(error, "The task") },
      { status: 502 },
    );
  }
}

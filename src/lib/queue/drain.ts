import "server-only";
import { basename } from "node:path";
import { createNcr } from "@/lib/repositories/ncr.repo";
import { recordQueuedAttachment } from "@/lib/repositories/attachment.repo";
import { drainQueue, listFailed, listPending } from "@/lib/queue/submissionQueue";

/**
 * Submits everything waiting for M1, oldest first.
 *
 * Each submission gets its NCR number at this point, not when it was typed —
 * numbers come from M1's own counter, which was unreachable at the time.
 */
export async function drainSubmissions() {
  return drainQueue({
    create: async (submission) => {
      const ncrId = await createNcr(submission.input, submission.createdBy);

      for (const filePath of submission.attachmentPaths) {
        // A failed attachment must not fail the NCR: the record is the point,
        // and the file is already safely on disk either way.
        try {
          await recordQueuedAttachment({
            ncrId,
            filePath,
            description: `NCR ${ncrId} — ${basename(filePath)}`,
            createdBy: submission.createdBy,
            jobId: submission.input.jobId,
            partId: submission.input.partId,
            simproJobId: submission.input.simproJobId,
          });
        } catch {
          // Reported through the queue entry's lastError on the next pass.
        }
      }

      return ncrId;
    },
  });
}

export async function queueStatus() {
  const [pending, failed] = await Promise.all([listPending(), listFailed()]);
  return {
    pending: pending.length,
    failed: failed.length,
    oldestQueuedAt: pending[0]?.queuedAt ?? null,
    entries: pending.map((entry) => ({
      queueId: entry.id,
      queuedAt: entry.queuedAt,
      createdBy: entry.createdBy,
      attempts: entry.attempts,
      lastError: entry.lastError,
      attachments: entry.attachmentPaths.length,
    })),
  };
}

import "server-only";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { NcrCreateInput } from "@/types/ncr";

/**
 * Durable holding pen for NCRs submitted while M1 is unreachable.
 *
 * The alternative is telling someone on the shop floor that the thing they
 * just wrote is gone. A queued submission keeps their words and their photos
 * and lands in M1 when it comes back.
 *
 * Files on disk rather than a table, deliberately: the database being down is
 * the case this exists for. One JSON file per submission, moved between
 * directories as it progresses, so nothing is lost if the process restarts
 * mid-drain.
 */

export type QueuedSubmission = {
  id: string;
  queuedAt: string;
  /** Who submitted it, for the M1 record once it lands. */
  createdBy: string;
  input: NcrCreateInput;
  /** Absolute paths of files already written to the attachment store. */
  attachmentPaths: string[];
  attempts: number;
  lastError: string | null;
  /** Set once it reaches M1. */
  ncrId?: string;
};

const PENDING = "pending";
const DONE = "done";
const FAILED = "failed";

function queueRoot() {
  return path.resolve(process.env.QUEUE_DIR ?? "./queue");
}

async function dir(name: string) {
  const target = path.join(queueRoot(), name);
  await mkdir(target, { recursive: true });
  return target;
}

/** Adds a submission to the queue and returns its reference. */
export async function enqueueSubmission(
  entry: Omit<QueuedSubmission, "id" | "queuedAt" | "attempts" | "lastError">,
): Promise<QueuedSubmission> {
  const submission: QueuedSubmission = {
    ...entry,
    id: randomUUID(),
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };

  const pending = await dir(PENDING);
  // Written to a temporary name first, then renamed: a reader can never see a
  // half-written file.
  const finalPath = path.join(pending, `${submission.id}.json`);
  const tempPath = `${finalPath}.writing`;
  await writeFile(tempPath, JSON.stringify(submission, null, 2), "utf8");
  await rename(tempPath, finalPath);

  return submission;
}

async function readQueue(name: string): Promise<QueuedSubmission[]> {
  const target = await dir(name);
  const files = (await readdir(target)).filter((f) => f.endsWith(".json"));

  const entries = await Promise.all(
    files.map(async (file) => {
      try {
        return JSON.parse(
          await readFile(path.join(target, file), "utf8"),
        ) as QueuedSubmission;
      } catch {
        return null; // Ignore anything unreadable rather than failing the lot.
      }
    }),
  );

  return entries
    .filter((entry): entry is QueuedSubmission => entry !== null)
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export const listPending = () => readQueue(PENDING);
export const listFailed = () => readQueue(FAILED);

async function move(submission: QueuedSubmission, to: string) {
  const from = path.join(await dir(PENDING), `${submission.id}.json`);
  const target = path.join(await dir(to), `${submission.id}.json`);
  await writeFile(from, JSON.stringify(submission, null, 2), "utf8");
  await rename(from, target);
}

export type DrainResult = {
  submitted: Array<{ queueId: string; ncrId: string }>;
  stillPending: number;
  failed: Array<{ queueId: string; error: string }>;
};

/**
 * Attempts every pending submission in the order it was queued.
 *
 * Order matters: NCR numbers are handed out on arrival, so draining oldest
 * first keeps the numbering roughly in the order people actually reported
 * things. A submission that fails often enough is set aside rather than
 * retried forever, so one bad record cannot block the rest.
 */
export async function drainQueue({
  create,
  maxAttempts = 5,
}: {
  create: (submission: QueuedSubmission) => Promise<string>;
  maxAttempts?: number;
}): Promise<DrainResult> {
  const pending = await listPending();
  const result: DrainResult = { submitted: [], stillPending: 0, failed: [] };

  for (const submission of pending) {
    try {
      const ncrId = await create(submission);
      await move({ ...submission, ncrId, lastError: null }, DONE);
      result.submitted.push({ queueId: submission.id, ncrId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      const attempts = submission.attempts + 1;

      if (attempts >= maxAttempts) {
        await move({ ...submission, attempts, lastError: message }, FAILED);
        result.failed.push({ queueId: submission.id, error: message });
      } else {
        const pendingDir = await dir(PENDING);
        await writeFile(
          path.join(pendingDir, `${submission.id}.json`),
          JSON.stringify({ ...submission, attempts, lastError: message }, null, 2),
          "utf8",
        );
        result.stillPending += 1;
      }
    }
  }

  return result;
}

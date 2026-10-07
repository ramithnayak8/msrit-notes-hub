import { hostname } from 'node:os';
import { logger } from '../lib/logger.js';
import { JobModel, type JobDoc } from '../models/Job.js';
import { SourceDocumentModel } from '../models/SourceDocument.js';
import { runJob } from './pipeline.js';

/** A job whose worker died mid-run is taken over after this long. */
const STALE_LOCK_MS = 10 * 60_000;
const POLL_MS = 2000;

const workerId = `${hostname()}:${process.pid}`;

/**
 * Claim the next job atomically. findOneAndUpdate matches and updates in one
 * operation on the server, so if two workers race for the same job only one
 * gets it. Jobs locked by a worker that stopped responding are reclaimed.
 */
export function claimNextJob(): Promise<JobDoc | null> {
  const now = new Date();
  return JobModel.findOneAndUpdate(
    {
      $or: [
        { status: 'queued', runAfter: { $lte: now } },
        { status: 'running', lockedAt: { $lt: new Date(now.getTime() - STALE_LOCK_MS) } },
      ],
    },
    { $set: { status: 'running', lockedAt: now, lockedBy: workerId }, $inc: { attempts: 1 } },
    { sort: { runAfter: 1 }, returnDocument: 'after' },
  );
}

async function processJob(job: JobDoc) {
  const t = Date.now();
  logger.info({ job: job.id, doc: String(job.documentId), attempt: job.attempts }, 'Job started');
  try {
    await runJob(job);
    await JobModel.updateOne({ _id: job._id }, { $set: { status: 'done', finishedAt: new Date(), stage: undefined }, $unset: { lockedAt: 1, lockedBy: 1 } });
    logger.info({ job: job.id, ms: Date.now() - t }, 'Job done');
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    const final = job.attempts >= job.maxAttempts;
    // Back off before retrying: 30s, 60s, ...
    await JobModel.updateOne(
      { _id: job._id },
      {
        $set: { status: final ? 'failed' : 'queued', lastError: message, runAfter: new Date(Date.now() + 30_000 * job.attempts), ...(final ? { finishedAt: new Date() } : {}) },
        $unset: { lockedAt: 1, lockedBy: 1 },
      },
    );
    if (final) await SourceDocumentModel.updateOne({ _id: job.documentId }, { $set: { status: 'failed', error: message } });
    logger.error({ job: job.id, attempt: job.attempts, final, err }, 'Job failed');
  }
}

/** Poll for jobs one at a time (OCR and embedding are CPU-bound). Returns a stop function. */
export function startWorker() {
  let stopped = false;
  let current: Promise<void> | null = null;

  const loop = async () => {
    logger.info({ workerId }, 'Ingestion worker started');
    while (!stopped) {
      try {
        const job = await claimNextJob();
        if (job) {
          current = processJob(job);
          await current;
          current = null;
          continue;
        }
      } catch (err) {
        logger.error({ err }, 'Worker loop error');
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  };
  void loop();

  return async () => {
    stopped = true;
    if (current) await current;
  };
}

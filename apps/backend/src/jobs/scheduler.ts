import { jobQueue } from './queue';
import { publishContentWorker } from './workers/publishContent.worker';
import { fetchMetricsWorker } from './workers/fetchMetrics.worker';
import { logger } from '../common/logger';

const POLL_INTERVAL_MS = 60_000; // 1 minute

const workerMap: Record<string, (payload: unknown) => Promise<void>> = {
  publish_content: publishContentWorker,
  fetch_metrics: fetchMetricsWorker,
};

async function processJobs(): Promise<void> {
  const pending = jobQueue.getPending();
  for (const job of pending) {
    const worker = workerMap[job.type];
    if (!worker) {
      logger.warn(`No worker found for job type: ${job.type}`);
      jobQueue.remove(job.id);
      continue;
    }
    try {
      await worker(job.payload);
      jobQueue.remove(job.id);
      logger.info(`Job completed: ${job.type} (${job.id})`);
    } catch (err) {
      logger.error(`Job failed: ${job.type} (${job.id})`, err);
    }
  }
}

export function startScheduler(): void {
  logger.info('Job scheduler started');
  setInterval(processJobs, POLL_INTERVAL_MS);
}

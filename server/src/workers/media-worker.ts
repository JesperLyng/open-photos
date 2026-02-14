import { Worker } from "bullmq";
import { redisConnectionOptions, type MediaProcessingJobData } from "../lib/queue.js";
import { processMediaAsset } from "../services/processing-service.js";

export function createMediaWorker() {
  const worker = new Worker<MediaProcessingJobData>(
    "media-processing",
    async (job) => {
      console.log(`[worker] processing job ${job.id}`, {
        assetId: job.data.assetId,
        attempt: job.attemptsMade + 1,
      });
      await processMediaAsset(job.data.assetId);
      return { success: true };
    },
    {
      connection: redisConnectionOptions,
      concurrency: 5,
      limiter: { max: 10, duration: 1000 },
    },
  );

  worker.on("completed", (job) => {
    console.log(`[worker] completed job ${job.id}`, { assetId: job.data.assetId });
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] failed job ${job?.id}`, {
      assetId: job?.data.assetId,
      error: err.message,
      attempt: job?.attemptsMade,
    });
  });

  worker.on("error", (err) => {
    console.error("[worker] error", err);
  });

  return worker;
}

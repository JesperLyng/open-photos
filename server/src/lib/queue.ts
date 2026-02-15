import { Queue } from "bullmq";
import { config } from "./config.js";

export const redisEnabled = Boolean(config.redisHost);

function buildConnectionOptions() {
  if (!redisEnabled) return null;
  return {
    host: config.redisHost,
    port: config.redisPort,
    password: config.redisPassword,
    db: config.redisDb,
    maxRetriesPerRequest: null as null,
  };
}

export const redisConnectionOptions = buildConnectionOptions();

export interface MediaProcessingJobData {
  assetId: string;
  tenantId: string;
  ownerId: string;
}

export const mediaProcessingQueue = redisConnectionOptions
  ? new Queue<MediaProcessingJobData>("media-processing", {
      connection: redisConnectionOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800 },
      },
    })
  : null;

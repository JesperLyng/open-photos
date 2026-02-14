import { Queue } from "bullmq";
import { config } from "./config.js";

const connectionOptions = {
  host: config.redisHost,
  port: config.redisPort,
  password: config.redisPassword,
  db: config.redisDb,
  maxRetriesPerRequest: null as null,
};

export { connectionOptions as redisConnectionOptions };

export interface MediaProcessingJobData {
  assetId: string;
  tenantId: string;
  ownerId: string;
}

export const mediaProcessingQueue = new Queue<MediaProcessingJobData>(
  "media-processing",
  {
    connection: connectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800 },
    },
  },
);

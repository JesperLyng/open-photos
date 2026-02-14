import "dotenv/config";
import { connectDb } from "./lib/db.js";
import { createMediaWorker } from "./workers/media-worker.js";

async function start() {
  await connectDb();
  const worker = createMediaWorker();

  console.log("[worker] media processing worker started");

  const shutdown = async () => {
    console.log("[worker] shutting down...");
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("[worker] failed to start", err);
  process.exit(1);
});

import "dotenv/config";
import http from "node:http";
import { connectDb } from "./lib/db.js";
import { redisEnabled } from "./lib/queue.js";
import { createMediaWorker } from "./workers/media-worker.js";

async function start() {
  if (!redisEnabled) {
    console.log("[worker] REDIS_HOST not set — media processing runs inline in the API. Worker exiting.");
    return;
  }

  await connectDb();
  const worker = createMediaWorker();

  console.log("[worker] media processing worker started");

  const port = Number(process.env.PORT || 3000);
  const healthServer = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  });
  healthServer.listen(port, "0.0.0.0", () => {
    console.log(`[worker] health endpoint listening on :${port}`);
  });

  const shutdown = async () => {
    console.log("[worker] shutting down...");
    healthServer.close();
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

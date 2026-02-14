import "dotenv/config";
import { connectDb, disconnectDb } from "../src/lib/db.ts";
import { MediaAsset } from "../src/models/media-asset.ts";
import { mediaProcessingQueue } from "../src/lib/queue.ts";

async function main() {
  const args = process.argv.slice(2);
  const argId = args.find((arg) => !arg.startsWith("--"));
  await connectDb();

  if (argId) {
    await mediaProcessingQueue.add(
      "reprocess-media",
      { assetId: argId, tenantId: "", ownerId: "" },
      { jobId: `reprocess-${argId}` },
    );
    console.log(`Queued reprocess for ${argId}`);
    await mediaProcessingQueue.close();
    await disconnectDb();
    return;
  }

  const assets = await MediaAsset.find({}).select("_id").lean();
  for (const asset of assets) {
    const id = asset._id.toString();
    await mediaProcessingQueue.add(
      "reprocess-media",
      { assetId: id, tenantId: "", ownerId: "" },
      { jobId: `reprocess-${id}` },
    );
    console.log(`Queued reprocess for ${id}`);
  }

  console.log(`Queued ${assets.length} assets for reprocessing`);
  await mediaProcessingQueue.close();
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

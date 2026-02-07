import "dotenv/config";
import { connectDb, disconnectDb } from "../src/lib/db.ts";
import { MediaAsset } from "../src/models/media-asset.ts";
import { processMediaAsset } from "../src/services/processing-service.ts";

async function main() {
  const argId = process.argv[2];
  await connectDb();

  if (argId) {
    await processMediaAsset(argId);
    console.log(`Reprocessed ${argId}`);
    await disconnectDb();
    return;
  }

  const assets = await MediaAsset.find({}).select("_id").lean();
  for (const asset of assets) {
    await processMediaAsset(asset._id.toString());
    console.log(`Reprocessed ${asset._id.toString()}`);
  }

  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

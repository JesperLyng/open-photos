import "dotenv/config";
import { connectDb, disconnectDb } from "../src/lib/db.ts";
import { MediaAsset } from "../src/models/media-asset.ts";
import { processMediaAsset } from "../src/services/processing-service.ts";

async function main() {
  const args = process.argv.slice(2);
  const regenerateDerived = !args.includes("--skip-thumbs") && !args.includes("--no-thumbs");
  const argId = args.find((arg) => !arg.startsWith("--"));
  await connectDb();

  if (argId) {
    await processMediaAsset(argId, { regenerateDerived });
    console.log(`Reprocessed ${argId}`);
    await disconnectDb();
    return;
  }

  const assets = await MediaAsset.find({}).select("_id").lean();
  for (const asset of assets) {
    await processMediaAsset(asset._id.toString(), { regenerateDerived });
    console.log(`Reprocessed ${asset._id.toString()}`);
  }

  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

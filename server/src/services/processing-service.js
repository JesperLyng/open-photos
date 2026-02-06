import sharp from "sharp";
import { MediaAsset } from "../models/media-asset.js";
import { getObjectBuffer, putObject } from "../lib/storage.js";

const THUMBNAILS = [
  { name: "small", size: 256 },
  { name: "medium", size: 1024 },
];

export async function processMediaAsset(assetId) {
  const asset = await MediaAsset.findById(assetId);
  if (!asset) return;

  try {
    asset.status = "processing";
    await asset.save();

    const originalBuffer = await getObjectBuffer({ key: asset.original.key });
    const image = sharp(originalBuffer);
    const metadata = await image.metadata();

    const derived = {};
    for (const thumb of THUMBNAILS) {
      const resize = await image
        .clone()
        .resize({ width: thumb.size, height: thumb.size, fit: "inside" })
        .jpeg({ quality: 80 })
        .toBuffer({ resolveWithObject: true });

      const key = `derived/${asset._id}/${thumb.name}.jpg`;
      await putObject({
        key,
        body: resize.data,
        contentType: "image/jpeg",
      });

      derived[thumb.name] = {
        key,
        width: resize.info.width,
        height: resize.info.height,
      };
    }

    asset.metadata = {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      cameraMake: metadata.make,
      cameraModel: metadata.model,
    };
    asset.derived = derived;
    asset.status = "ready";
    await asset.save();
  } catch (error) {
    console.error("processing failed", { error, assetId: asset._id.toString() });
    asset.status = "failed";
    await asset.save();
  }
}

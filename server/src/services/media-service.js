import { MediaAsset } from "../models/media-asset.js";

export async function createMediaAsset({
  ownerId,
  key,
  bucket,
  contentType,
  size,
  filename,
  checksum,
}) {
  return MediaAsset.create({
    ownerId,
    original: { key, bucket, contentType, size },
    filename,
    checksum,
  });
}

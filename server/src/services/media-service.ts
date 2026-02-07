import { MediaAsset } from "../models/media-asset.js";

export async function findDuplicateAsset({ ownerId, checksum, size }) {
  if (!checksum) return null;
  return MediaAsset.findOne({ ownerId, checksum, ...(size ? { "original.size": size } : {}) });
}

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

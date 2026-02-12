import { MediaAsset } from "../models/media-asset.js";

function buildTenantFilter(tenantId, ownerId) {
  return {
    $or: [{ tenantId }, { tenantId: { $exists: false }, ownerId }],
  };
}

export async function findDuplicateAsset({ tenantId, ownerId, checksum, size }) {
  if (!checksum) return null;
  return MediaAsset.findOne({
    ...buildTenantFilter(tenantId, ownerId),
    checksum,
    ...(size ? { "original.size": size } : {}),
  });
}

export async function createMediaAsset({
  tenantId,
  ownerId,
  key,
  bucket,
  contentType,
  size,
  filename,
  checksum,
}) {
  return MediaAsset.create({
    tenantId,
    ownerId,
    original: { key, bucket, contentType, size },
    filename,
    checksum,
  });
}

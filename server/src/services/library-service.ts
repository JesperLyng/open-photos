import { MediaAsset } from "../models/media-asset.js";

export async function listMediaAssets({ ownerId, limit, cursor }) {
  const query = { ownerId };
  if (cursor) {
    query._id = { $lt: cursor };
  }

  const items = await MediaAsset.find(query)
    .sort({ "metadata.capturedAt": -1, createdAt: -1 })
    .limit(limit)
    .lean();

  const nextCursor = items.length === limit ? items[items.length - 1]._id.toString() : null;

  return { items, nextCursor };
}

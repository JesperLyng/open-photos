import { MediaAsset } from "../models/media-asset.js";

export async function listMediaAssets({ ownerId, limit, cursor }) {
  const query = { ownerId };
  if (cursor) {
    query._id = { $lt: cursor };
  }

  const items = await MediaAsset.find(query)
    .sort({ _id: -1 })
    .limit(limit)
    .select({
      status: 1,
      filename: 1,
      createdAt: 1,
      original: 1,
      derived: 1,
      metadata: 1,
      tags: 1,
    })
    .lean();

  const nextCursor = items.length === limit ? items[items.length - 1]._id.toString() : null;

  return { items, nextCursor };
}

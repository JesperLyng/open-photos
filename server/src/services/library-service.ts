import { MediaAsset } from "../models/media-asset.js";
import { AlbumItem } from "../models/album-item.js";

function addTenantFilter(query, tenantId, ownerId) {
  const clause = { $or: [{ tenantId }, { tenantId: { $exists: false }, ownerId }] };
  if (query.$and) {
    query.$and.push(clause);
  } else {
    query.$and = [clause];
  }
}

export async function listMediaAssets({ tenantId, ownerId, limit, cursor, filter }) {
  const query = {};
  addTenantFilter(query, tenantId, ownerId);
  if (cursor) {
    query._id = { $lt: cursor };
  }

  const expr = [];
  const dateExpr = { $ifNull: ["$metadata.capturedAt", "$createdAt"] };
  if (filter?.from) {
    expr.push({ $gte: [dateExpr, filter.from] });
  }
  if (filter?.to) {
    expr.push({ $lte: [dateExpr, filter.to] });
  }
  if (filter?.tags?.length) {
    expr.push({
      $setIsSubset: [
        filter.tags,
        {
          $map: {
            input: { $ifNull: ["$tags", []] },
            as: "tag",
            in: { $toLower: "$$tag" },
          },
        },
      ],
    });
  }
  if (filter?.favoriteOnly) {
    query.favorite = true;
  }
  if (filter?.albumId) {
    const items = await AlbumItem.find({
      tenantId,
      albumId: filter.albumId,
    }).select({ assetId: 1 });
    const ids = items.map((item) => item.assetId);
    if (ids.length === 0) {
      return { items: [], nextCursor: null };
    }
    query._id = {
      ...(query._id || {}),
      $in: ids,
    };
  }
  if (expr.length > 0) {
    query.$expr = { $and: expr };
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
      favorite: 1,
      metadata: 1,
      tags: 1,
    })
    .lean();

  const nextCursor = items.length === limit ? items[items.length - 1]._id.toString() : null;

  return { items, nextCursor };
}

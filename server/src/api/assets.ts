import { MediaAsset } from "../models/media-asset.ts";
import { deleteObject, signDownload } from "../lib/storage.ts";

function mapAsset(item, thumbUrl, originalUrl) {
  return {
    id: item._id,
    status: item.status,
    filename: item.filename,
    createdAt: item.createdAt,
    original: item.original,
    derived: item.derived,
    metadata: item.metadata,
    tags: item.tags,
    thumbUrl,
    originalUrl,
  };
}

export function registerAssetRoutes(app) {
  app.get(
    "/api/assets/:id",
    { preHandler: [app.requireAuth] },
    async (request) => {
      const assetId = request.params.id;
      const asset = await MediaAsset.findOne({ _id: assetId, ownerId: request.user.id });
      if (!asset) {
        throw app.httpErrors.notFound("asset not found");
      }

      let thumbUrl = null;
      let originalUrl = null;
      if (asset.derived?.small?.key) {
        thumbUrl = await signDownload({ key: asset.derived.small.key, expiresIn: 60 * 10 });
      }
      if (asset.original?.key) {
        originalUrl = await signDownload({ key: asset.original.key, expiresIn: 60 * 10 });
      }

      return mapAsset(asset, thumbUrl, originalUrl);
    },
  );

  app.delete(
    "/api/assets/:id",
    { preHandler: [app.requireAuth] },
    async (request) => {
      const assetId = request.params.id;
      const asset = await MediaAsset.findOne({ _id: assetId, ownerId: request.user.id });
      if (!asset) {
        throw app.httpErrors.notFound("asset not found");
      }

      const keys = [
        asset.original?.key,
        asset.derived?.small?.key,
        asset.derived?.medium?.key,
      ].filter(Boolean);

      await Promise.allSettled(keys.map((key) => deleteObject({ key })));
      await asset.deleteOne();

      return { ok: true };
    },
  );

  app.patch(
    "/api/assets/:id/tags",
    { preHandler: [app.requireAuth] },
    async (request) => {
      const assetId = request.params.id;
      const asset = await MediaAsset.findOne({ _id: assetId, ownerId: request.user.id });
      if (!asset) {
        throw app.httpErrors.notFound("asset not found");
      }

      const { tags } = request.body || {};
      if (!Array.isArray(tags)) {
        throw app.httpErrors.badRequest("tags must be an array");
      }

      const normalized: string[] = [];
      const seen = new Set<string>();
      for (const tag of tags) {
        if (typeof tag !== "string") continue;
        const trimmed = tag.replace(/\s+/g, " ").trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push(trimmed.slice(0, 64));
      }

      asset.tags = normalized;
      await asset.save();

      return { ok: true, tags: asset.tags };
    },
  );
}

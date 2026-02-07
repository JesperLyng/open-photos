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
}

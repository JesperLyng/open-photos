import { MediaAsset } from "../models/media-asset.js";
import { AlbumItem } from "../models/album-item.js";
import { deleteObject, signDownload } from "../lib/storage.js";
import { updateTagCatalog } from "../services/tag-service.js";
import {
  getAssetSchema,
  assetParamsSchema,
  updateTagsSchema,
  updateFavoriteSchema,
  batchFavoritesSchema,
} from "../schemas/assets.js";

function mapAsset(item, urls: { thumbUrl?: string; previewUrl?: string; originalUrl?: string }) {
  const payload: Record<string, unknown> = {
    id: item._id,
    status: item.status,
    filename: item.filename,
    createdAt: item.createdAt,
    original: item.original,
    derived: item.derived,
    metadata: item.metadata,
    favorite: item.favorite,
    tags: item.tags,
  };

  if ("thumbUrl" in urls) {
    payload.thumbUrl = urls.thumbUrl;
  }
  if ("previewUrl" in urls) {
    payload.previewUrl = urls.previewUrl;
  }
  if ("originalUrl" in urls) {
    payload.originalUrl = urls.originalUrl;
  }

  return payload;
}

function buildTenantFilter(tenantId, ownerId) {
  return {
    $or: [{ tenantId }, { tenantId: { $exists: false }, ownerId }],
  };
}

export function registerAssetRoutes(app) {
  app.get(
    "/api/assets/:id",
    {
      preHandler: [app.requireAuth],
      schema: getAssetSchema,
    },
    async (request) => {
      const { id: assetId } = request.params;
      const asset = await MediaAsset.findOne({
        _id: assetId,
        ...buildTenantFilter(request.user.tenantId, request.user.id),
      });
      if (!asset) {
        throw app.httpErrors.notFound("asset not found");
      }

      const includeRaw = request.query.include || "";
      const include = new Set(
        String(includeRaw)
          .split(",")
          .map((part) => part.trim().toLowerCase())
          .filter(Boolean),
      );

      const urls: { thumbUrl?: string; previewUrl?: string; originalUrl?: string } = {};
      if (include.has("thumb") && asset.derived?.small?.key) {
        urls.thumbUrl = await signDownload({ key: asset.derived.small.key, expiresIn: 60 * 10 });
      }
      if (include.has("preview") && asset.derived?.medium?.key) {
        urls.previewUrl = await signDownload({
          key: asset.derived.medium.key,
          expiresIn: 60 * 10,
        });
      }
      if (include.has("original") && asset.original?.key) {
        urls.originalUrl = await signDownload({ key: asset.original.key, expiresIn: 60 * 10 });
      }

      return mapAsset(asset, urls);
    },
  );

  app.delete(
    "/api/assets/:id",
    {
      preHandler: [app.requireAuth],
      schema: assetParamsSchema,
    },
    async (request) => {
      const { id: assetId } = request.params;
      const asset = await MediaAsset.findOne({
        _id: assetId,
        ...buildTenantFilter(request.user.tenantId, request.user.id),
      });
      if (!asset) {
        throw app.httpErrors.notFound("asset not found");
      }

      const beforeTags = asset.tags || [];

      const keys = [
        asset.original?.key,
        asset.derived?.small?.key,
        asset.derived?.medium?.key,
      ].filter(Boolean);

      await Promise.allSettled(keys.map((key) => deleteObject({ key })));
      await asset.deleteOne();
      await AlbumItem.deleteMany({
        tenantId: request.user.tenantId,
        assetId: asset._id,
      });
      await updateTagCatalog({
        tenantId: request.user.tenantId,
        beforeTags,
        afterTags: [],
      });

      return { ok: true };
    },
  );

  app.patch(
    "/api/assets/:id/tags",
    {
      preHandler: [app.requireAuth],
      schema: updateTagsSchema,
    },
    async (request) => {
      const { id: assetId } = request.params;
      const asset = await MediaAsset.findOne({
        _id: assetId,
        ...buildTenantFilter(request.user.tenantId, request.user.id),
      });
      if (!asset) {
        throw app.httpErrors.notFound("asset not found");
      }

      const beforeTags = asset.tags || [];
      const { tags } = request.body;

      const normalized: string[] = [];
      const seen = new Set<string>();
      for (const tag of tags) {
        const trimmed = tag.replace(/\s+/g, " ").trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push(trimmed.slice(0, 64));
      }

      asset.tags = normalized;
      await asset.save();

      await updateTagCatalog({
        tenantId: request.user.tenantId,
        beforeTags,
        afterTags: asset.tags,
      });

      return { ok: true, tags: asset.tags };
    },
  );

  app.patch(
    "/api/assets/:id/favorite",
    {
      preHandler: [app.requireAuth],
      schema: updateFavoriteSchema,
    },
    async (request) => {
      const { id: assetId } = request.params;
      const asset = await MediaAsset.findOne({
        _id: assetId,
        ...buildTenantFilter(request.user.tenantId, request.user.id),
      });
      if (!asset) {
        throw app.httpErrors.notFound("asset not found");
      }

      const { favorite } = request.body;
      asset.favorite = favorite;
      await asset.save();

      return { ok: true, favorite: asset.favorite };
    },
  );

  app.patch(
    "/api/assets/favorites",
    {
      preHandler: [app.requireAuth],
      schema: batchFavoritesSchema,
    },
    async (request) => {
      const { ids, favorite } = request.body;

      await MediaAsset.updateMany(
        {
          _id: { $in: ids },
          ...buildTenantFilter(request.user.tenantId, request.user.id),
        },
        { $set: { favorite } },
      );

      return { ok: true };
    },
  );
}

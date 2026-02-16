import { createHash, randomBytes } from "node:crypto";
import { Album } from "../models/album.js";
import { AlbumItem } from "../models/album-item.js";
import { MediaAsset } from "../models/media-asset.js";
import { ShareLink } from "../models/share-link.js";
import { config } from "../lib/config.js";
import { signDownload } from "../lib/storage.js";
import {
  createAlbumShareSchema,
  createAssetShareSchema,
  deleteShareSchema,
  publicShareAssetSchema,
  publicShareSchema,
} from "../schemas/shares.js";

type ShareAsset = {
  _id: string | { toString(): string };
  status?: string;
  filename?: string | null;
  createdAt?: string | Date | null;
  original?: { key?: string } | null;
  derived?: {
    small?: { key?: string | null; width?: number | null; height?: number | null } | null;
    medium?: { key?: string | null; width?: number | null; height?: number | null } | null;
  } | null;
  metadata?: Record<string, unknown> | null;
  favorite?: boolean;
  tags?: string[] | null;
};

type ShareSummary = {
  id: string;
  type: "asset" | "album";
  url: string | null;
  targetId: string | null;
  targetLabel: string;
  createdAt: Date | string | null;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createShareUrl(token: string) {
  return `${config.publicAppOrigin.replace(/\/$/, "")}/share/${token}`;
}

function buildTenantFilter(tenantId: string, ownerId: string) {
  return {
    $or: [{ tenantId }, { tenantId: { $exists: false }, ownerId }],
  };
}

function parseInclude(value?: string) {
  return new Set(
    String(value || "")
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
}

function mapMetadata(metadata: Record<string, unknown> | null | undefined, includeExif = false) {
  if (!metadata) return undefined;
  const cloned = { ...metadata };
  if (!includeExif && "exif" in cloned) {
    delete cloned.exif;
  }
  return cloned;
}

async function mapAssetForPublic(
  asset: ShareAsset,
  include: Set<string>,
  includeExif = false,
) {
  const payload: Record<string, unknown> = {
    id: String(asset._id),
    status: asset.status,
    filename: asset.filename,
    createdAt: asset.createdAt,
    original: asset.original,
    derived: asset.derived,
    metadata: mapMetadata(asset.metadata, includeExif),
    favorite: Boolean(asset.favorite),
    tags: Array.isArray(asset.tags) ? asset.tags : [],
  };

  if (include.has("thumb") && asset.derived?.small?.key) {
    payload.thumbUrl = await signDownload({
      key: asset.derived.small.key,
      expiresIn: 60 * 10,
    });
  }
  if (include.has("preview")) {
    const previewKey = asset.derived?.medium?.key || asset.original?.key;
    if (previewKey) {
      payload.previewUrl = await signDownload({
        key: previewKey,
        expiresIn: 60 * 10,
      });
    }
  }
  if (include.has("original") && asset.original?.key) {
    payload.originalUrl = await signDownload({
      key: asset.original.key,
      expiresIn: 60 * 10,
    });
  }

  return payload;
}

async function issueShareToken(payload: {
  tenantId: string;
  ownerId: string;
  type: "asset" | "album";
  assetId?: string;
  albumId?: string;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    try {
      await ShareLink.create({
        tenantId: payload.tenantId,
        ownerId: payload.ownerId,
        type: payload.type,
        assetId: payload.assetId,
        albumId: payload.albumId,
        token,
        tokenHash,
      });
      return token;
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: number }).code === 11000
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("unable to generate share token");
}

export function registerShareRoutes(app) {
  app.get(
    "/api/shares",
    {
      preHandler: [app.requireAuth],
    },
    async (request) => {
      const shares = await ShareLink.find(
        buildTenantFilter(request.user.tenantId, request.user.id),
      )
        .sort({ createdAt: -1, _id: -1 })
        .limit(500)
        .lean();

      const assetIds = shares
        .filter((share) => share.type === "asset" && share.assetId)
        .map((share) => share.assetId);
      const albumIds = shares
        .filter((share) => share.type === "album" && share.albumId)
        .map((share) => share.albumId);

      const [assets, albums] = await Promise.all([
        assetIds.length
          ? MediaAsset.find({
              _id: { $in: assetIds },
              ...buildTenantFilter(request.user.tenantId, request.user.id),
            })
              .select({ filename: 1 })
              .lean()
          : [],
        albumIds.length
          ? Album.find({
              _id: { $in: albumIds },
              tenantId: request.user.tenantId,
            })
              .select({ name: 1 })
              .lean()
          : [],
      ]);

      const assetNames = new Map<string, string>();
      for (const asset of assets) {
        if (typeof asset.filename === "string" && asset.filename.trim()) {
          assetNames.set(String(asset._id), asset.filename);
        }
      }

      const albumNames = new Map<string, string>();
      for (const album of albums) {
        if (typeof album.name === "string" && album.name.trim()) {
          albumNames.set(String(album._id), album.name);
        }
      }

      const items: ShareSummary[] = shares.map((share) => {
        const targetId =
          share.type === "asset"
            ? share.assetId
              ? String(share.assetId)
              : null
            : share.albumId
              ? String(share.albumId)
              : null;
        const targetLabel =
          share.type === "asset"
            ? assetNames.get(String(share.assetId)) || "Shared photo"
            : albumNames.get(String(share.albumId)) || "Shared album";

        return {
          id: String(share._id),
          type: share.type,
          url: share.token ? createShareUrl(share.token) : null,
          targetId,
          targetLabel,
          createdAt: share.createdAt || null,
        };
      });

      return { items };
    },
  );

  app.post(
    "/api/shares/assets/:id",
    {
      preHandler: [app.requireAuth],
      schema: createAssetShareSchema,
    },
    async (request) => {
      const { id: assetId } = request.params;
      const asset = await MediaAsset.findOne({
        _id: assetId,
        ...buildTenantFilter(request.user.tenantId, request.user.id),
      }).select({ _id: 1 });

      if (!asset) {
        throw app.httpErrors.notFound("asset not found");
      }

      const token = await issueShareToken({
        tenantId: request.user.tenantId,
        ownerId: request.user.id,
        type: "asset",
        assetId: String(asset._id),
      });

      return {
        ok: true,
        type: "asset",
        token,
        url: createShareUrl(token),
      };
    },
  );

  app.post(
    "/api/shares/albums/:id",
    {
      preHandler: [app.requireAuth],
      schema: createAlbumShareSchema,
    },
    async (request) => {
      const { id: albumId } = request.params;
      const album = await Album.findOne({
        _id: albumId,
        tenantId: request.user.tenantId,
      }).select({ _id: 1 });

      if (!album) {
        throw app.httpErrors.notFound("album not found");
      }

      const token = await issueShareToken({
        tenantId: request.user.tenantId,
        ownerId: request.user.id,
        type: "album",
        albumId: String(album._id),
      });

      return {
        ok: true,
        type: "album",
        token,
        url: createShareUrl(token),
      };
    },
  );

  app.delete(
    "/api/shares/:id",
    {
      preHandler: [app.requireAuth],
      schema: deleteShareSchema,
    },
    async (request) => {
      const { id } = request.params;
      const result = await ShareLink.deleteOne({
        _id: id,
        ...buildTenantFilter(request.user.tenantId, request.user.id),
      });

      if (!result.deletedCount) {
        throw app.httpErrors.notFound("share not found");
      }

      return { ok: true };
    },
  );

  app.get(
    "/api/public/shares/:token",
    {
      schema: publicShareSchema,
    },
    async (request) => {
      const { token } = request.params;
      const tokenHash = hashToken(token);
      const share = await ShareLink.findOne({
        $or: [{ tokenHash }, { token }],
      }).lean();
      if (!share) {
        throw app.httpErrors.notFound("share not found");
      }

      if (share.type === "asset" && share.assetId) {
        const asset = await MediaAsset.findOne({
          _id: share.assetId,
          status: { $ne: "failed" },
          ...buildTenantFilter(String(share.tenantId), String(share.ownerId)),
        }).lean();
        if (!asset) {
          throw app.httpErrors.notFound("share not found");
        }

        return {
          type: "asset",
          sharedAt: share.createdAt,
          asset: await mapAssetForPublic(
            asset,
            new Set(["thumb", "preview", "original"]),
            true,
          ),
        };
      }

      if (share.type === "album" && share.albumId) {
        const album = await Album.findOne({
          _id: share.albumId,
          tenantId: share.tenantId,
        }).lean();
        if (!album) {
          throw app.httpErrors.notFound("share not found");
        }

        const albumItems = await AlbumItem.find({
          tenantId: share.tenantId,
          albumId: share.albumId,
        })
          .select({ assetId: 1 })
          .lean();

        const assetIds = albumItems.map((item) => item.assetId);
        const assets = assetIds.length
          ? await MediaAsset.find({
              _id: { $in: assetIds },
              status: { $ne: "failed" },
              ...buildTenantFilter(String(share.tenantId), String(share.ownerId)),
            })
              .select({
                status: 1,
                filename: 1,
                createdAt: 1,
                original: 1,
                derived: 1,
                metadata: 1,
                favorite: 1,
                tags: 1,
              })
              .lean()
          : [];

        assets.sort((a, b) => {
          const aDate = new Date(a.metadata?.capturedAt || a.createdAt || 0).getTime();
          const bDate = new Date(b.metadata?.capturedAt || b.createdAt || 0).getTime();
          if (aDate !== bDate) return bDate - aDate;
          return String(b._id).localeCompare(String(a._id));
        });

        return {
          type: "album",
          sharedAt: share.createdAt,
          album: {
            id: String(album._id),
            name: album.name,
            description: album.description,
            createdAt: album.createdAt,
          },
          items: await Promise.all(
            assets.map((asset) => mapAssetForPublic(asset, new Set(["thumb", "preview"]))),
          ),
        };
      }

      throw app.httpErrors.notFound("share not found");
    },
  );

  app.get(
    "/api/public/shares/:token/assets/:assetId",
    {
      schema: publicShareAssetSchema,
    },
    async (request) => {
      const { token, assetId } = request.params;
      const tokenHash = hashToken(token);
      const share = await ShareLink.findOne({
        $or: [{ tokenHash }, { token }],
      }).lean();
      if (!share) {
        throw app.httpErrors.notFound("share not found");
      }

      let allowed = false;
      if (share.type === "asset" && share.assetId) {
        allowed = String(share.assetId) === assetId;
      }
      if (share.type === "album" && share.albumId) {
        const albumItem = await AlbumItem.findOne({
          tenantId: share.tenantId,
          albumId: share.albumId,
          assetId,
        })
          .select({ _id: 1 })
          .lean();
        allowed = Boolean(albumItem);
      }
      if (!allowed) {
        throw app.httpErrors.notFound("share not found");
      }

      const asset = await MediaAsset.findOne({
        _id: assetId,
        status: { $ne: "failed" },
        ...buildTenantFilter(String(share.tenantId), String(share.ownerId)),
      }).lean();
      if (!asset) {
        throw app.httpErrors.notFound("share not found");
      }

      const include = parseInclude(request.query.include);
      if (!include.size) {
        include.add("preview");
        include.add("original");
      }

      return await mapAssetForPublic(asset, include, true);
    },
  );
}

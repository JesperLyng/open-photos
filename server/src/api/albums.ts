import { Album } from "../models/album.js";
import { AlbumItem } from "../models/album-item.js";

function mapAlbum(album) {
  return {
    id: album._id,
    name: album.name,
    description: album.description,
    createdAt: album.createdAt,
  };
}

export function registerAlbumRoutes(app) {
  app.get(
    "/api/albums",
    { preHandler: [app.requireAuth] },
    async (request) => {
      const items = await Album.find({ tenantId: request.user.tenantId })
        .sort({ createdAt: -1 })
        .lean();
      return { items: items.map(mapAlbum) };
    },
  );

  app.post(
    "/api/albums",
    { preHandler: [app.requireAuth] },
    async (request) => {
      const { name, description } = request.body || {};
      if (!name || typeof name !== "string") {
        throw app.httpErrors.badRequest("name is required");
      }

      const album = await Album.create({
        tenantId: request.user.tenantId,
        name: name.trim().slice(0, 64),
        description: typeof description === "string" ? description.trim().slice(0, 256) : "",
      });

      return { ok: true, album: mapAlbum(album) };
    },
  );

  app.patch(
    "/api/albums/:id",
    { preHandler: [app.requireAuth] },
    async (request) => {
      const albumId = request.params.id;
      const { name, description } = request.body || {};
      if (!name && !description) {
        throw app.httpErrors.badRequest("name or description required");
      }

      const updates: Record<string, unknown> = {};
      if (typeof name === "string") updates.name = name.trim().slice(0, 64);
      if (typeof description === "string") updates.description = description.trim().slice(0, 256);

      const album = await Album.findOneAndUpdate(
        { _id: albumId, tenantId: request.user.tenantId },
        { $set: updates },
        { new: true },
      );
      if (!album) {
        throw app.httpErrors.notFound("album not found");
      }

      return { ok: true, album: mapAlbum(album) };
    },
  );

  app.delete(
    "/api/albums/:id",
    { preHandler: [app.requireAuth] },
    async (request) => {
      const albumId = request.params.id;
      await Album.deleteOne({ _id: albumId, tenantId: request.user.tenantId });
      await AlbumItem.deleteMany({ albumId, tenantId: request.user.tenantId });
      return { ok: true };
    },
  );

  app.post(
    "/api/albums/:id/items",
    { preHandler: [app.requireAuth] },
    async (request) => {
      const albumId = request.params.id;
      const { ids } = request.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        throw app.httpErrors.badRequest("ids must be a non-empty array");
      }

      const album = await Album.findOne({ _id: albumId, tenantId: request.user.tenantId });
      if (!album) {
        throw app.httpErrors.notFound("album not found");
      }

      const docs = ids.map((assetId) => ({
        tenantId: request.user.tenantId,
        albumId,
        assetId,
      }));
      try {
        await AlbumItem.insertMany(docs, { ordered: false });
      } catch (error) {
        // ignore duplicate key errors
        if (error?.code !== 11000) {
          throw error;
        }
      }
      return { ok: true };
    },
  );

  app.delete(
    "/api/albums/:id/items",
    { preHandler: [app.requireAuth] },
    async (request) => {
      const albumId = request.params.id;
      const { ids } = request.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        throw app.httpErrors.badRequest("ids must be a non-empty array");
      }

      const album = await Album.findOne({ _id: albumId, tenantId: request.user.tenantId });
      if (!album) {
        throw app.httpErrors.notFound("album not found");
      }

      await AlbumItem.deleteMany({
        tenantId: request.user.tenantId,
        albumId,
        assetId: { $in: ids },
      });

      return { ok: true };
    },
  );
}

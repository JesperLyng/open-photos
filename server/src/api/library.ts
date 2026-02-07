import { listMediaAssets } from "../services/library-service.js";
import { signDownload } from "../lib/storage.js";

export function registerLibraryRoutes(app) {
  app.get(
    "/api/library",
    { preHandler: [app.requireAuth] },
    async (request) => {
      const limit = Math.min(Number(request.query.limit || 50), 200);
      const cursor = request.query.cursor || null;

      const { items, nextCursor } = await listMediaAssets({
        ownerId: request.user.id,
        limit,
        cursor,
      });

      const mapped = await Promise.all(
        items.map(async (item) => {
          let thumbUrl = null;
          let originalUrl = null;
          if (item.derived?.small?.key) {
            thumbUrl = await signDownload({ key: item.derived.small.key, expiresIn: 60 * 10 });
          }
          if (item.original?.key) {
            originalUrl = await signDownload({ key: item.original.key, expiresIn: 60 * 10 });
          }

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
        }),
      );

      return {
        items: mapped,
        nextCursor,
      };
    },
  );
}

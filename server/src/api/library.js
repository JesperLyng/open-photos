import { listMediaAssets } from "../services/library-service.js";

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

      return {
        items: items.map((item) => ({
          id: item._id,
          status: item.status,
          filename: item.filename,
          createdAt: item.createdAt,
          original: item.original,
        })),
        nextCursor,
      };
    },
  );
}

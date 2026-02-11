import { listMediaAssets } from "../services/library-service.js";
import { signDownload } from "../lib/storage.js";

function parseDate(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function parseTags(value) {
  if (typeof value !== "string" || value.trim() === "") return [];
  const tags = value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(tags));
}

export function registerLibraryRoutes(app) {
  app.get(
    "/api/library",
    { preHandler: [app.requireAuth] },
    async (request) => {
      const limit = Math.min(Number(request.query.limit || 50), 200);
      const cursor = request.query.cursor || null;
      const from = parseDate(request.query.from);
      const to = parseDate(request.query.to);
      const tags = parseTags(request.query.tags);

      const { items, nextCursor } = await listMediaAssets({
        ownerId: request.user.id,
        limit,
        cursor,
        filter: { from, to, tags },
      });

      const mapped = await Promise.all(
        items.map(async (item) => {
          let thumbUrl = null;
          if (item.derived?.small?.key) {
            thumbUrl = await signDownload({ key: item.derived.small.key, expiresIn: 60 * 10 });
          }

          const metadata = item.metadata ? { ...item.metadata } : undefined;
          if (metadata?.exif) {
            delete metadata.exif;
          }

          return {
            id: item._id,
            status: item.status,
            filename: item.filename,
            createdAt: item.createdAt,
            original: item.original,
            derived: item.derived,
            metadata,
            tags: item.tags,
            thumbUrl,
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

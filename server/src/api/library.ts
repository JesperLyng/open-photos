import { listMediaAssets } from "../services/library-service.js";
import { signDownload } from "../lib/storage.js";
import { libraryQuerySchema } from "../schemas/library.js";

function parseTags(value?: string) {
  if (!value || value.trim() === "") return [];
  const tags = value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(tags));
}

export function registerLibraryRoutes(app) {
  app.get(
    "/api/library",
    {
      preHandler: [app.requireAuth],
      schema: libraryQuerySchema,
    },
    async (request) => {
      const { limit, cursor, from, to, tags, favorite, albumId } = request.query;
      const parsedFrom = from ? new Date(from) : null;
      const parsedTo = to ? new Date(to) : null;
      const parsedTags = parseTags(tags);
      const favoriteOnly = favorite === "true" ? true : null;

      const { items, nextCursor } = await listMediaAssets({
        tenantId: request.user.tenantId,
        ownerId: request.user.id,
        limit,
        cursor: cursor || null,
        filter: {
          from: parsedFrom,
          to: parsedTo,
          tags: parsedTags,
          favoriteOnly,
          albumId: albumId || null,
        },
      });

      const mapped = await Promise.all(
        items.map(async (item) => {
          let thumbUrl: string | null = null;
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
            favorite: item.favorite,
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

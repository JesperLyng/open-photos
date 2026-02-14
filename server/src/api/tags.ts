import { listTags } from "../services/tag-service.js";
import { tagsQuerySchema } from "../schemas/tags.js";

export function registerTagRoutes(app) {
  app.get(
    "/api/tags",
    {
      preHandler: [app.requireAuth],
      schema: tagsQuerySchema,
    },
    async (request) => {
      const { q: query, limit } = request.query;
      const items = await listTags({ tenantId: request.user.tenantId, query, limit });
      return { items };
    },
  );
}

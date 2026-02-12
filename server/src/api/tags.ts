import { listTags } from "../services/tag-service.js";

export function registerTagRoutes(app) {
  app.get(
    "/api/tags",
    { preHandler: [app.requireAuth] },
    async (request) => {
      const query = request.query?.q || "";
      const limitRaw = request.query?.limit || "";
      const limit = Math.min(Number(limitRaw || 200), 500);
      const items = await listTags({ tenantId: request.user.tenantId, query, limit });
      return { items };
    },
  );
}

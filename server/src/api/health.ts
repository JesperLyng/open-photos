export function registerHealthRoutes(app) {
  app.get("/health", async () => ({ status: "ok" }));
  app.get("/api/health", async () => ({ status: "ok" }));
}

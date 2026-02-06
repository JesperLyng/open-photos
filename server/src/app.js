import Fastify from "fastify";
import { registerHealthRoutes } from "./api/health.js";
import { registerAuthRoutes } from "./api/auth.js";
import { requireAuth } from "./lib/auth.js";
import { setErrorHandlers } from "./lib/errors.js";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.decorate("requireAuth", requireAuth);

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  setErrorHandlers(app);

  return app;
}

import Fastify from "fastify";
import { registerHealthRoutes } from "./api/health.js";
import { registerAuthRoutes } from "./api/auth.js";
import { requireAuth } from "./lib/auth.js";
import { setErrorHandlers } from "./lib/errors.js";
import { registerUploadRoutes } from "./api/uploads.js";
import { registerLibraryRoutes } from "./api/library.js";
import sensible from "@fastify/sensible";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.register(sensible);
  app.decorate("requireAuth", requireAuth);

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerUploadRoutes(app);
  registerLibraryRoutes(app);
  setErrorHandlers(app);

  return app;
}

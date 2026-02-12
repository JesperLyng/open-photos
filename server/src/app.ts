import Fastify from "fastify";
import { registerHealthRoutes } from "./api/health.js";
import { registerAuthRoutes } from "./api/auth.js";
import { requireAuth } from "./lib/auth.js";
import { setErrorHandlers } from "./lib/errors.js";
import { registerUploadRoutes } from "./api/uploads.js";
import { registerLibraryRoutes } from "./api/library.js";
import { registerAssetRoutes } from "./api/assets.js";
import { registerTagRoutes } from "./api/tags.js";
import { registerAlbumRoutes } from "./api/albums.js";
import { registerRealtime } from "./lib/realtime.js";
import sensible from "@fastify/sensible";

export function buildServer() {
  const app = Fastify({ logger: true });

  app.register(sensible);
  app.decorate("requireAuth", requireAuth);

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerUploadRoutes(app);
  registerLibraryRoutes(app);
  registerAssetRoutes(app);
  registerTagRoutes(app);
  registerAlbumRoutes(app);
  registerRealtime(app);
  setErrorHandlers(app);

  return app;
}

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { registerHealthRoutes } from "./api/health.js";
import { registerAuthRoutes } from "./api/auth.js";
import { requireAuth } from "./lib/auth.js";
import { setErrorHandlers } from "./lib/errors.js";
import { registerUploadRoutes } from "./api/uploads.js";
import { registerLibraryRoutes } from "./api/library.js";
import { registerAssetRoutes } from "./api/assets.js";
import { registerTagRoutes } from "./api/tags.js";
import { registerAlbumRoutes } from "./api/albums.js";
import { registerShareRoutes } from "./api/shares.js";
import { registerRealtime } from "./lib/realtime.js";
import { corsConfig, helmetConfig } from "./lib/security.js";
import { config } from "./lib/config.js";

export function buildServer() {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(sensible);
  app.register(cors, corsConfig);
  app.register(helmet, helmetConfig);

  if (config.rateLimitEnabled) {
    app.register(rateLimit, { global: true, max: 100, timeWindow: "1 minute" });
  }

  app.decorate("requireAuth", requireAuth);

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerUploadRoutes(app);
  registerLibraryRoutes(app);
  registerAssetRoutes(app);
  registerTagRoutes(app);
  registerAlbumRoutes(app);
  registerShareRoutes(app);
  registerRealtime(app);
  setErrorHandlers(app);

  return app;
}

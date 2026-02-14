import { config } from "./config.js";

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
]);

export const corsConfig = {
  origin: config.allowedOrigins
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  credentials: true,
};

export const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "*"],
      mediaSrc: ["'self'", "blob:", "*"],
      connectSrc: ["'self'", "*"],
    },
  },
  crossOriginResourcePolicy: { policy: "cross-origin" as const },
};

export const authRateLimit = {
  max: 10,
  timeWindow: "1 minute",
};

export const uploadRateLimit = {
  max: 50,
  timeWindow: "1 minute",
};

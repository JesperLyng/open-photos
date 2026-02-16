import dotenv from "dotenv";

dotenv.config({
  path: process.env.ENV_FILE || ".env",
  override: false,
});

const allowedOriginsValue = process.env.ALLOWED_ORIGINS || "http://localhost:5173";
const firstAllowedOrigin =
  allowedOriginsValue
    .split(",")
    .map((value) => value.trim())
    .find(Boolean) || "http://localhost:5173";

export const config = {
  env: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/open-photos",
  oidcIssuer: process.env.OIDC_ISSUER || "http://localhost:8080/realms/open-photos",
  oidcAudience:
    (process.env.OIDC_AUDIENCE || "account,open-photos-client")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  oidcJwksUri:
    process.env.OIDC_JWKS_URI ||
    "http://localhost:8080/realms/open-photos/protocol/openid-connect/certs",
  s3Endpoint: process.env.S3_ENDPOINT || "https://s3.fr-par.scw.cloud",
  s3Region: process.env.S3_REGION || "fr-par",
  s3Bucket: process.env.S3_BUCKET || "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  allowedOrigins: allowedOriginsValue,
  publicAppOrigin: process.env.PUBLIC_APP_ORIGIN || firstAllowedOrigin,
  rateLimitEnabled: process.env.RATE_LIMIT_ENABLED !== "false",
  redisHost: process.env.REDIS_HOST || "",
  redisPort: Number(process.env.REDIS_PORT || 6379),
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  redisDb: Number(process.env.REDIS_DB || 0),
};

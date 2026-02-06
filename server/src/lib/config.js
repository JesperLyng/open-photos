import "dotenv/config";

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
};

import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "./config.js";
import { findOrCreateUserFromClaims } from "../services/user-service.js";

const jwks = createRemoteJWKSet(new URL(config.oidcJwksUri));

export async function authenticateToken(token) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: config.oidcIssuer,
    audience: config.oidcAudience,
  });

  return findOrCreateUserFromClaims(payload);
}

export async function requireAuth(request, reply) {
  const authHeader = request.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    reply.code(401);
    throw new Error("missing bearer token");
  }

  const user = await authenticateToken(token);
  request.user = {
    id: String(user.id),
    tenantId: String(user.id),
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
  };
}

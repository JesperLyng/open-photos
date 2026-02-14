import { authRateLimit } from "../lib/security.js";

export function registerAuthRoutes(app) {
  app.get(
    "/api/auth/me",
    {
      preHandler: [app.requireAuth],
      config: { rateLimit: authRateLimit },
    },
    async (request) => {
      const user = request.user;
      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      };
    },
  );
}

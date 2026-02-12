import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      tenantId: string;
      email: string;
      emailVerified: boolean;
      displayName?: string;
      avatarUrl?: string;
    };
  }

  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

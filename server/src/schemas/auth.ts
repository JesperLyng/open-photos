import { z } from "zod";

export const oidcClaimsSchema = z.object({
  sub: z.string(),
  email: z.string().email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  preferred_username: z.string().optional(),
  given_name: z.string().optional(),
  picture: z.string().optional(),
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
}).passthrough();

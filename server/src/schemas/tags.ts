import { z } from "zod";

export const tagsQuerySchema = {
  querystring: z.object({
    q: z.string().default(""),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  }),
};

import { z } from "zod";

export const libraryQuerySchema = {
  querystring: z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    cursor: z.string().optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    tags: z.string().optional(),
    favorite: z.enum(["true", "false"]).optional(),
    albumId: z.string().optional(),
  }),
};

import { z } from "zod";

export const uploadInitSchema = {
  body: z.object({
    filename: z.string().min(1).max(500),
    contentType: z.string().regex(/^(image|video)\//, "contentType must be image/* or video/*"),
    size: z.number().int().positive().max(500 * 1024 * 1024).optional(),
    checksum: z.string().optional(),
  }),
};

export const uploadCompleteSchema = {
  body: z.object({
    key: z.string().min(1),
    bucket: z.string().min(1),
    contentType: z.string().optional(),
    size: z.number().int().positive().optional(),
    filename: z.string().optional(),
    checksum: z.string().optional(),
  }),
};

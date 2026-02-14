import { z } from "zod";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const objectId = z.string().regex(objectIdPattern, "Invalid ObjectId");

export const albumParamsSchema = {
  params: z.object({
    id: objectId,
  }),
};

export const createAlbumSchema = {
  body: z.object({
    name: z.string().min(1).max(64).transform((v) => v.trim()),
    description: z.string().max(256).transform((v) => v.trim()).default(""),
  }),
};

export const updateAlbumSchema = {
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    name: z.string().min(1).max(64).transform((v) => v.trim()).optional(),
    description: z.string().max(256).transform((v) => v.trim()).optional(),
  }).refine((data) => data.name || data.description, {
    message: "name or description required",
  }),
};

export const albumItemsSchema = {
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    ids: z.array(objectId).min(1).max(500),
  }),
};

import { z } from "zod";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const objectId = z.string().regex(objectIdPattern, "Invalid ObjectId");

export const assetParamsSchema = {
  params: z.object({
    id: objectId,
  }),
};

export const getAssetSchema = {
  params: z.object({
    id: objectId,
  }),
  querystring: z.object({
    include: z.string().optional(),
  }),
};

export const updateTagsSchema = {
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    tags: z.array(z.string().max(64)).max(100),
  }),
};

export const updateFavoriteSchema = {
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    favorite: z.boolean(),
  }),
};

export const batchFavoritesSchema = {
  body: z.object({
    ids: z.array(objectId).min(1).max(500),
    favorite: z.boolean(),
  }),
};

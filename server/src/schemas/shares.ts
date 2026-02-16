import { z } from "zod";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const objectId = z.string().regex(objectIdPattern, "Invalid ObjectId");
const tokenPattern = /^[A-Za-z0-9_-]{16,256}$/;
const shareToken = z.string().regex(tokenPattern, "Invalid share token");

export const createAssetShareSchema = {
  params: z.object({
    id: objectId,
  }),
};

export const createAlbumShareSchema = {
  params: z.object({
    id: objectId,
  }),
};

export const publicShareSchema = {
  params: z.object({
    token: shareToken,
  }),
};

export const publicShareAssetSchema = {
  params: z.object({
    token: shareToken,
    assetId: objectId,
  }),
  querystring: z.object({
    include: z.string().optional(),
  }),
};

export const deleteShareSchema = {
  params: z.object({
    id: objectId,
  }),
};

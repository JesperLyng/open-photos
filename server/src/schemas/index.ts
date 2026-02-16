export { uploadInitSchema, uploadCompleteSchema } from "./uploads.js";
export { libraryQuerySchema } from "./library.js";
export {
  getAssetSchema,
  assetParamsSchema,
  updateTagsSchema,
  updateFavoriteSchema,
  batchFavoritesSchema,
} from "./assets.js";
export { oidcClaimsSchema } from "./auth.js";
export {
  albumParamsSchema,
  createAlbumSchema,
  updateAlbumSchema,
  albumItemsSchema,
} from "./albums.js";
export { tagsQuerySchema } from "./tags.js";
export {
  createAssetShareSchema,
  createAlbumShareSchema,
  publicShareSchema,
  publicShareAssetSchema,
} from "./shares.js";

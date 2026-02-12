import { Schema, model } from "mongoose";

const albumItemSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    albumId: { type: Schema.Types.ObjectId, required: true, ref: "Album", index: true },
    assetId: { type: Schema.Types.ObjectId, required: true, ref: "MediaAsset", index: true },
  },
  { timestamps: true },
);

albumItemSchema.index({ tenantId: 1, albumId: 1, assetId: 1 }, { unique: true });
albumItemSchema.index({ tenantId: 1, assetId: 1 });

export const AlbumItem = model("AlbumItem", albumItemSchema);

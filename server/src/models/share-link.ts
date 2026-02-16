import { Schema, model } from "mongoose";

const shareLinkSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["asset", "album"],
      required: true,
      index: true,
    },
    assetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", index: true },
    albumId: { type: Schema.Types.ObjectId, ref: "Album", index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true },
);

shareLinkSchema.index({ tenantId: 1, type: 1, assetId: 1 });
shareLinkSchema.index({ tenantId: 1, type: 1, albumId: 1 });

export const ShareLink = model("ShareLink", shareLinkSchema);

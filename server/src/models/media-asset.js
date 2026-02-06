import { Schema, model } from "mongoose";

const mediaAssetSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["uploaded", "processing", "ready", "failed"],
      default: "uploaded",
      index: true,
    },
    original: {
      key: { type: String, required: true },
      bucket: { type: String, required: true },
      contentType: { type: String },
      size: { type: Number },
    },
    filename: { type: String },
    checksum: { type: String },
  },
  { timestamps: true },
);

export const MediaAsset = model("MediaAsset", mediaAssetSchema);

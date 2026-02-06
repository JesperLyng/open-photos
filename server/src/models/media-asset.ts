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
    derived: {
      small: {
        key: { type: String },
        width: { type: Number },
        height: { type: Number },
      },
      medium: {
        key: { type: String },
        width: { type: Number },
        height: { type: Number },
      },
    },
    metadata: {
      width: { type: Number },
      height: { type: Number },
      format: { type: String },
      capturedAt: { type: Date },
      cameraMake: { type: String },
      cameraModel: { type: String },
    },
    filename: { type: String },
    checksum: { type: String },
  },
  { timestamps: true },
);

export const MediaAsset = model("MediaAsset", mediaAssetSchema);

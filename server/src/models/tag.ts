import { Schema, model } from "mongoose";

const tagSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    key: { type: String, required: true },
    label: { type: String, required: true },
    count: { type: Number, default: 0 },
    lastUsedAt: { type: Date },
  },
  { timestamps: true },
);

tagSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const Tag = model("Tag", tagSchema);

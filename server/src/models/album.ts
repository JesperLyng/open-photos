import { Schema, model } from "mongoose";

const albumSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
  },
  { timestamps: true },
);

albumSchema.index({ tenantId: 1, name: 1 });

export const Album = model("Album", albumSchema);

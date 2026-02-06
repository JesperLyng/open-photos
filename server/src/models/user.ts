import { Schema, model } from "mongoose";

const userSchema = new Schema(
  {
    oidcSubject: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    emailVerified: { type: Boolean, default: false },
    displayName: { type: String },
    avatarUrl: { type: String },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const User = model("User", userSchema);

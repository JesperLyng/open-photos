import { User } from "../models/user.js";

export async function findOrCreateUserFromClaims(claims) {
  const oidcSubject = claims.sub;
  const email = claims.email || "";
  const displayName =
    claims.name || claims.preferred_username || claims.given_name || email || "";
  const avatarUrl = claims.picture || "";
  const emailVerified = Boolean(claims.email_verified);

  const update: Record<string, unknown> = {
    lastLoginAt: new Date(),
    emailVerified,
  };
  if (email) update.email = email;
  if (displayName) update.displayName = displayName;
  if (avatarUrl) update.avatarUrl = avatarUrl;

  const user = await User.findOneAndUpdate(
    { oidcSubject },
    { $set: update, $setOnInsert: { oidcSubject } },
    { upsert: true, new: true },
  );

  return user;
}

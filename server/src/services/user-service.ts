import { User } from "../models/user.js";

export async function findOrCreateUserFromClaims(claims) {
  const oidcSubject = claims.sub;
  const email = claims.email || "";
  const displayName =
    claims.name || claims.preferred_username || claims.given_name || email || "";
  const avatarUrl = claims.picture || "";
  const emailVerified = Boolean(claims.email_verified);

  let user = await User.findOne({ oidcSubject });
  if (!user) {
    user = await User.create({
      oidcSubject,
      email,
      displayName,
      avatarUrl,
      emailVerified,
      lastLoginAt: new Date(),
    });
  } else {
    user.lastLoginAt = new Date();
    if (email && user.email !== email) user.email = email;
    user.emailVerified = emailVerified;
    if (displayName) user.displayName = displayName;
    if (avatarUrl) user.avatarUrl = avatarUrl;
    await user.save();
  }

  return user;
}

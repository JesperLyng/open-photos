import { userManager } from "./auth/oidc";

userManager.signinSilentCallback().catch((error) => {
  console.error("Silent renew failed", error);
});

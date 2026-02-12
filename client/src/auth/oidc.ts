import { UserManager, WebStorageStateStore } from "oidc-client-ts";

const authority = import.meta.env.VITE_OIDC_AUTHORITY || "http://localhost:8080/realms/open-photos";
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID || "open-photos-client";
const redirectUri = import.meta.env.VITE_OIDC_REDIRECT_URI || "http://localhost:5173/callback";
const silentRedirectUri =
  import.meta.env.VITE_OIDC_SILENT_REDIRECT_URI || "http://localhost:5173/silent-renew.html";
const postLogoutRedirectUri =
  import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI || "http://localhost:5173";
const scope = import.meta.env.VITE_OIDC_SCOPE || "openid profile email";

export const userManager = new UserManager({
  authority,
  client_id: clientId,
  redirect_uri: redirectUri,
  silent_redirect_uri: silentRedirectUri,
  post_logout_redirect_uri: postLogoutRedirectUri,
  response_type: "code",
  scope,
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
});

export async function getUser() {
  return userManager.getUser();
}

export async function login() {
  return userManager.signinRedirect();
}

export function signup() {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
  });
  const registrationUrl = `${authority}/protocol/openid-connect/registrations?${params.toString()}`;
  window.location.assign(registrationUrl);
}

export async function logout() {
  return userManager.signoutRedirect();
}

export async function handleCallback() {
  return userManager.signinRedirectCallback();
}

export async function signinSilent() {
  return userManager.signinSilent();
}

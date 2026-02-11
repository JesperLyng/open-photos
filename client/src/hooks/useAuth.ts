import { useEffect, useState } from "react";
import { getUser, handleCallback, login } from "../auth/oidc";

export type AuthState = {
  status: string;
  user?: { access_token: string; profile?: { email?: string } };
  error?: string;
};

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        if (window.location.pathname === "/callback") {
          const handled = sessionStorage.getItem("oidc_callback_handled");
          if (!handled) {
            sessionStorage.setItem("oidc_callback_handled", "true");
            await handleCallback();
            window.history.replaceState({}, document.title, "/");
            sessionStorage.removeItem("oidc_callback_handled");
          }
        }

        const user = await getUser();
        if (!isMounted) return;

        if (user && !user.expired) {
          setAuth({ status: "authenticated", user });
        } else {
          setAuth({ status: "anonymous" });
        }
      } catch (err) {
        if (isMounted) {
          setAuth({ status: "error", error: (err as Error).message });
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (auth.status === "authenticated") {
      sessionStorage.removeItem("oidc_login_started");
    }
  }, [auth.status]);

  useEffect(() => {
    if (auth.status !== "anonymous") return;
    const started = sessionStorage.getItem("oidc_login_started");
    if (started) return;
    sessionStorage.setItem("oidc_login_started", "true");
    login();
  }, [auth.status]);

  return auth;
}

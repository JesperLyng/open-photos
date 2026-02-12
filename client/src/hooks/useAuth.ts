import { useEffect, useRef, useState } from "react";
import { getUser, handleCallback, login, signinSilent, userManager } from "../auth/oidc";

export type AuthState = {
  status: string;
  user?: { access_token: string; profile?: { email?: string } };
  error?: string;
};

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const refreshRef = useRef<Promise<unknown> | null>(null);

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
          return;
        }

        if (user?.expired) {
          try {
            const refreshed = await signinSilent();
            if (!isMounted) return;
            if (refreshed && !refreshed.expired) {
              setAuth({ status: "authenticated", user: refreshed });
              return;
            }
          } catch {
            // fall through to anonymous
          }
        }

        setAuth({ status: "anonymous" });
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
    let active = true;

    const refreshToken = async () => {
      if (refreshRef.current) {
        return refreshRef.current;
      }
      refreshRef.current = signinSilent()
        .then((user) => {
          if (!active) return;
          if (user && !user.expired) {
            setAuth({ status: "authenticated", user });
          } else {
            setAuth({ status: "anonymous" });
          }
        })
        .catch(() => {
          if (!active) return;
          setAuth({ status: "anonymous" });
        })
        .finally(() => {
          refreshRef.current = null;
        });

      return refreshRef.current;
    };

    const handleUserLoaded = (user: any) => {
      if (!active) return;
      if (user && !user.expired) {
        setAuth({ status: "authenticated", user });
      }
    };
    const handleUserUnloaded = () => {
      if (!active) return;
      setAuth({ status: "anonymous" });
    };
    const handleTokenExpiring = () => {
      void refreshToken();
    };
    const handleTokenExpired = () => {
      void refreshToken();
    };

    userManager.events.addUserLoaded(handleUserLoaded);
    userManager.events.addUserUnloaded(handleUserUnloaded);
    userManager.events.addAccessTokenExpiring(handleTokenExpiring);
    userManager.events.addAccessTokenExpired(handleTokenExpired);

    userManager.startSilentRenew?.();

    return () => {
      active = false;
      userManager.events.removeUserLoaded(handleUserLoaded);
      userManager.events.removeUserUnloaded(handleUserUnloaded);
      userManager.events.removeAccessTokenExpiring(handleTokenExpiring);
      userManager.events.removeAccessTokenExpired(handleTokenExpired);
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

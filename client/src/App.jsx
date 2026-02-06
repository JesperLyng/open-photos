import { useEffect, useState } from "react";
import { getUser, handleCallback, login, logout, signup } from "./auth/oidc.js";
import "./App.css";

function App() {
  const [auth, setAuth] = useState({ status: "loading" });
  const [me, setMe] = useState({ status: "idle" });

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
          setAuth({ status: "error", error: err.message });
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadMe() {
      if (auth.status !== "authenticated") {
        setMe({ status: "idle" });
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        });
        if (!res.ok) {
          if (isMounted) {
            setMe({ status: "error", error: `API error (${res.status})` });
          }
          return;
        }
        const data = await res.json();
        if (isMounted) {
          setMe({ status: "ok", data });
        }
      } catch (err) {
        if (isMounted) {
          setMe({ status: "error", error: err.message });
        }
      }
    }

    loadMe();

    return () => {
      isMounted = false;
    };
  }, [auth]);

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Open Photos</h1>
          <p className="subtitle">Auth status + API profile</p>
        </div>
        <div className={`badge ${auth.status}`}>
          {auth.status === "authenticated" ? "signed in" : auth.status}
        </div>
      </header>

      <section className="card">
        <h2>Authentication</h2>
        {auth.status === "loading" && <p>Checking session...</p>}
        {auth.status === "error" && <p className="error">{auth.error}</p>}
        {auth.status === "anonymous" && (
          <div className="stack">
            <button className="button" onClick={login}>
              Sign in with Keycloak
            </button>
            <button className="button ghost" onClick={signup}>
              Create account
            </button>
          </div>
        )}
        {auth.status === "authenticated" && (
          <div className="stack">
            <div>
              <strong>{auth.user.profile?.email || "Unknown email"}</strong>
              <div className="muted">OIDC sub: {auth.user.profile?.sub}</div>
            </div>
            <button className="button ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>API /api/auth/me</h2>
        {me.status === "idle" && <p>Sign in to fetch profile.</p>}
        {me.status === "ok" && <pre>{JSON.stringify(me.data, null, 2)}</pre>}
        {me.status === "error" && <p className="error">{me.error}</p>}
      </section>
    </div>
  );
}

export default App;

import { useEffect, useState } from "react";
import { getUser, handleCallback, login, logout, signup } from "./auth/oidc.js";
import "./App.css";

function App() {
  const [auth, setAuth] = useState({ status: "loading" });
  const [me, setMe] = useState({ status: "idle" });
  const [upload, setUpload] = useState({ status: "idle" });
  const [library, setLibrary] = useState({ status: "idle", items: [] });

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

  useEffect(() => {
    let isMounted = true;

    async function loadLibrary() {
      if (auth.status !== "authenticated") {
        setLibrary({ status: "idle", items: [] });
        return;
      }

      try {
        const res = await fetch("/api/library", {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        });

        if (!res.ok) {
          if (isMounted) {
            setLibrary({ status: "error", items: [], error: `API error (${res.status})` });
          }
          return;
        }

        const data = await res.json();
        if (isMounted) {
          setLibrary({ status: "ok", items: data.items || [], nextCursor: data.nextCursor });
        }
      } catch (err) {
        if (isMounted) {
          setLibrary({ status: "error", items: [], error: err.message });
        }
      }
    }

    loadLibrary();

    return () => {
      isMounted = false;
    };
  }, [auth]);

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0 || auth.status !== "authenticated") return;

    setUpload({ status: "init", total: files.length, done: 0 });

    try {
      for (const file of files) {
        const initRes = await fetch("/api/uploads/init", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.user.access_token}`,
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          }),
        });

        if (!initRes.ok) {
          setUpload({ status: "error", error: `Init failed (${initRes.status})` });
          return;
        }

        const initData = await initRes.json();
        setUpload((prev) => ({ ...prev, status: "uploading" }));

        const putRes = await fetch(initData.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": initData.contentType,
          },
          body: file,
        });

        if (!putRes.ok) {
          setUpload({ status: "error", error: `Upload failed (${putRes.status})` });
          return;
        }

        setUpload((prev) => ({ ...prev, status: "finalizing" }));
        const completeRes = await fetch("/api/uploads/complete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.user.access_token}`,
          },
          body: JSON.stringify({
            key: initData.key,
            bucket: initData.bucket,
            contentType: initData.contentType,
            size: initData.size,
            filename: initData.filename,
          }),
        });

        if (!completeRes.ok) {
          setUpload({ status: "error", error: `Complete failed (${completeRes.status})` });
          return;
        }

        results.push(initData.filename);
        setUpload((prev) => ({
          ...prev,
          status: "done",
          done: (prev.done || 0) + 1,
        }));
      }

      event.target.value = "";

      const res = await fetch("/api/library", {
        headers: {
          Authorization: `Bearer ${auth.user.access_token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setLibrary({ status: "ok", items: data.items || [], nextCursor: data.nextCursor });
      }
    } catch (err) {
      setUpload({ status: "error", error: err.message });
    }
  }

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
        <h2>Upload</h2>
        {auth.status !== "authenticated" && <p>Sign in to upload files.</p>}
        {auth.status === "authenticated" && (
          <div className="stack">
            <input type="file" multiple onChange={handleUpload} />
            {upload.status !== "idle" && (
              <div className="muted">
                Status: {upload.status}
                {upload.total ? ` (${upload.done || 0}/${upload.total})` : ""}
              </div>
            )}
            {upload.status === "error" && <div className="error">{upload.error}</div>}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Library</h2>
        {library.status === "idle" && <p>Sign in to view your library.</p>}
        {library.status === "error" && <p className="error">{library.error}</p>}
        {library.status === "ok" && library.items.length === 0 && (
          <p>No assets yet.</p>
        )}
        {library.status === "ok" && library.items.length > 0 && (
          <ul className="list">
            {library.items.map((item) => (
              <li key={item.id}>
                <strong>{item.filename || item.original?.key}</strong>
                <div className="muted">{item.status}</div>
              </li>
            ))}
          </ul>
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

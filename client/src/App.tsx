import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from "react";
import { getUser, handleCallback, login, logout, signup } from "./auth/oidc";
import "./App.css";

type LibraryItem = {
  id: string;
  status: string;
  filename?: string;
  original?: { key?: string };
  thumbUrl?: string | null;
  originalUrl?: string | null;
  createdAt?: string;
  metadata?: { capturedAt?: string };
};

function App() {
  const [auth, setAuth] = useState({ status: "loading" });
  const [, setUpload] = useState({ status: "idle" });
  const [library, setLibrary] = useState<{
    status: string;
    items: LibraryItem[];
    nextCursor?: string | null;
    error?: string;
  }>({ status: "idle", items: [] });
  const gridItems = library.items;
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const apiOrigin = import.meta.env.VITE_API_ORIGIN || "http://localhost:3000";

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

  async function fetchLibrary(token: string) {
    const res = await fetch("/api/library", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      setLibrary({ status: "error", items: [], error: `API error (${res.status})` });
      return;
    }

    const data = await res.json();
    setLibrary({ status: "ok", items: data.items || [], nextCursor: data.nextCursor });
  }

  async function fetchAsset(token: string, assetId: string) {
    const res = await fetch(`/api/assets/${assetId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    return res.json();
  }

  useEffect(() => {
    let isMounted = true;

    async function loadLibrary() {
      if (auth.status !== "authenticated") {
        setLibrary({ status: "idle", items: [] });
        return;
      }

      try {
        await fetchLibrary(auth.user.access_token);
      } catch (err) {
        if (isMounted) {
          setLibrary({ status: "error", items: [], error: (err as Error).message });
        }
      }
    }

    loadLibrary();

    return () => {
      isMounted = false;
    };
  }, [auth]);

  useEffect(() => {
    if (auth.status !== "authenticated") {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const wsOrigin = apiOrigin.replace(/^http/, "ws");
    const url = new URL("/ws", wsOrigin);
    const socket = new WebSocket(url.toString());
    wsRef.current = socket;

    socket.addEventListener("open", () => {
      console.log("[ws] open");
      socket.send(JSON.stringify({ type: "auth", token: auth.user.access_token }));
    });
    socket.addEventListener("message", (event) => {
      console.log("[ws] message", event.data);
    });
    socket.addEventListener("close", () => console.log("[ws] close"));
    socket.addEventListener("error", (event) => console.log("[ws] error", event));

    socket.addEventListener("message", async (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "asset_processed") {
          const updated = await fetchAsset(auth.user.access_token, message.assetId);
          if (!updated) return;
          setLibrary((prev) => ({
            ...prev,
            items: prev.items.map((item) => (item.id === updated.id ? updated : item)),
          }));
        }
      } catch {
        // ignore
      }
    });

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [auth, apiOrigin]);

  async function computeSHA256(file: File) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>, fileOverride?: File[]) {
    const files = fileOverride ?? Array.from(event.target.files || []);
    if (files.length === 0 || auth.status !== "authenticated") return;

    setUpload({ status: "init", total: files.length, done: 0 });

    try {
      for (const file of files) {
        const checksum = await computeSHA256(file);
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
            checksum,
          }),
        });

        if (!initRes.ok) {
          setUpload({ status: "error", error: `Init failed (${initRes.status})` });
          return;
        }

        const initData = await initRes.json();
        if (initData.duplicate) {
          setUpload((prev) => ({
            ...prev,
            status: "duplicate",
            done: (prev.done || 0) + 1,
          }));
          continue;
        }
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
            checksum,
          }),
        });

        if (!completeRes.ok) {
          setUpload({ status: "error", error: `Complete failed (${completeRes.status})` });
          return;
        }

        setUpload((prev) => ({
          ...prev,
          status: "done",
          done: (prev.done || 0) + 1,
        }));
      }

      event.target.value = "";
      await fetchLibrary(auth.user.access_token);
    } catch (err) {
      setUpload({ status: "error", error: (err as Error).message });
    }
  }

  const currentItem = viewerIndex !== null ? gridItems[viewerIndex] : null;

  function groupByYear(items: LibraryItem[]) {
    const groups: Record<string, LibraryItem[]> = {};
    for (const item of items) {
      const dateSource = item.metadata?.capturedAt || item.createdAt;
      const date = dateSource ? new Date(dateSource) : new Date();
      const year = String(date.getFullYear());
      if (!groups[year]) groups[year] = [];
      groups[year].push(item);
    }
    return groups;
  }

  function toggleSelect(index: number, event: MouseEvent) {
    const isShift = event.shiftKey;
    const isToggle = event.ctrlKey || event.metaKey;
    const item = gridItems[index];
    if (!item) return;

    if (isShift) {
      if (lastSelectedIndex === null) {
        setSelection(new Set([item.id]));
        setLastSelectedIndex(index);
        return;
      }

      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const next = new Set(selection);
      for (let i = start; i <= end; i += 1) {
        const id = gridItems[i]?.id;
        if (id) next.add(id);
      }
      setSelection(next);
      return;
    }

    if (isToggle) {
      const next = new Set(selection);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      setSelection(next);
      setLastSelectedIndex(index);
      return;
    }

    if (selection.size > 0) {
      setSelection(new Set([item.id]));
      setLastSelectedIndex(index);
      return;
    }

    setViewerIndex(index);
  }

  async function deleteSelected() {
    if (selection.size === 0) return;
    if (!window.confirm(`Delete ${selection.size} photo(s)?`)) return;

    const ids = Array.from(selection);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/assets/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }),
      ),
    );

    setSelection(new Set());
    setLastSelectedIndex(null);

    await fetchLibrary(auth.user.access_token);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (viewerIndex === null) return;
      if (event.key === "Escape") {
        setViewerIndex(null);
      }
      if (event.key === "ArrowRight") {
        setViewerIndex((prev) =>
          prev === null ? prev : Math.min(prev + 1, gridItems.length - 1),
        );
      }
      if (event.key === "ArrowLeft") {
        setViewerIndex((prev) => (prev === null ? prev : Math.max(prev - 1, 0)));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerIndex, gridItems.length]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!menuOpen) return;
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  async function toggleFullscreen() {
    if (!document.fullscreenElement && viewerRef.current) {
      await viewerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div className="title">
          <h1>Open Photos</h1>
        </div>
        <div className="header-actions">
          <label
            className={`icon-button ${auth.status !== "authenticated" ? "disabled" : ""}`}
            title="Upload photos"
          >
            <input
              type="file"
              multiple
              onChange={handleUpload}
              disabled={auth.status !== "authenticated"}
            />
            <span className="icon">+</span>
          </label>
          <div className="user-menu" ref={menuRef}>
            <button
              className="user-button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="user-avatar" />
            </button>
            {menuOpen && (
              <div className="menu" role="menu">
                {auth.status === "loading" && (
                  <div className="menu-item">Checking session...</div>
                )}
                {auth.status === "error" && (
                  <div className="menu-item error">{auth.error}</div>
                )}
                {auth.status === "anonymous" && (
                  <>
                    <button className="menu-item" onClick={login}>
                      Sign in
                    </button>
                    <button className="menu-item" onClick={signup}>
                      Create account
                    </button>
                  </>
                )}
                {auth.status === "authenticated" && (
                  <>
                    <div className="menu-item muted">
                      {auth.user.profile?.email || "Signed in"}
                    </div>
                    <button className="menu-item" onClick={logout}>
                      Sign out
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="library-section">
        {auth.status !== "authenticated" && <p>Sign in to upload files.</p>}
        {library.status === "idle" && <p>Sign in to view your library.</p>}
        {library.status === "error" && <p className="error">{library.error}</p>}
        {selection.size > 0 && (
          <div className="selection-bar">
            <div>{selection.size} selected</div>
            <button className="button ghost" onClick={deleteSelected}>
              Delete
            </button>
          </div>
        )}
        {library.status === "ok" && library.items.length === 0 && <p>No assets yet.</p>}
        {library.status === "ok" && library.items.length > 0 && (
          <div className="year-groups">
            {Object.entries(groupByYear(gridItems))
              .sort((a, b) => Number(b[0]) - Number(a[0]))
              .map(([year, items]) => (
                <div key={year} className="year-group">
                  <div className="year-header">{year}</div>
                  <div
                    className={`grid-frame ${isDragging ? "dragging" : ""}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDragEnter={() => setIsDragging(true)}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDragging(false);
                      const files = event.dataTransfer?.files;
                      if (!files || files.length === 0) return;
                      handleUpload(
                        { target: event.currentTarget } as unknown as ChangeEvent<HTMLInputElement>,
                        Array.from(files),
                      );
                    }}
                  >
                    <div className="grid">
                      {items.map((item) => {
                        const globalIndex = gridItems.findIndex((entry) => entry.id === item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`grid-cell ${selection.has(item.id) ? "selected" : ""}`}
                            onClick={(event) => toggleSelect(globalIndex, event)}
                          >
                            {item.thumbUrl ? (
                              <img
                                className="grid-thumb"
                                src={item.thumbUrl}
                                alt={item.filename || "asset"}
                              />
                            ) : (
                              <div className="grid-thumb placeholder" />
                            )}
                            <div className="grid-meta">
                              <div className="grid-title">
                                {item.filename || item.original?.key}
                              </div>
                              {item.status !== "ready" && <div className="muted">{item.status}</div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {currentItem && (
        <div className="viewer" role="dialog" aria-modal="true" ref={viewerRef}>
          <button className="viewer-backdrop" onClick={() => setViewerIndex(null)} />
          <div className={`viewer-content ${isFullscreen ? "fullscreen" : ""}`}>
            <div className="viewer-topbar">
              {!isFullscreen && (
                <button className="viewer-close" onClick={() => setViewerIndex(null)}>
                  Close
                </button>
              )}
              <button className="viewer-fullscreen" onClick={toggleFullscreen}>
                {isFullscreen ? "Exit full screen" : "Full screen"}
              </button>
            </div>
            {currentItem.thumbUrl ? (
              <img
                className="viewer-image"
                src={currentItem.originalUrl || currentItem.thumbUrl}
                alt={currentItem.filename || "asset"}
              />
            ) : (
              <div className="viewer-image placeholder" />
            )}
            {!isFullscreen && (
              <>
                <div className="viewer-meta">
                  <div className="viewer-title">
                    {currentItem.filename || currentItem.original?.key}
                  </div>
                  <div className="muted">{currentItem.status}</div>
                </div>
                <div className="viewer-actions">
                  <button
                    className="button ghost"
                    onClick={() => setViewerIndex((prev) => (prev ? prev - 1 : 0))}
                    disabled={viewerIndex === 0}
                  >
                    Previous
                  </button>
                  <button
                    className="button"
                    onClick={() =>
                      setViewerIndex((prev) =>
                        prev === null ? prev : Math.min(prev + 1, gridItems.length - 1),
                      )
                    }
                    disabled={viewerIndex === gridItems.length - 1}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

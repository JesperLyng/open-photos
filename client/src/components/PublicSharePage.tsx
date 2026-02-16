import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { apiOrigin } from "../lib/api";
import type { LibraryItem } from "../types/media";
import "./PublicSharePage.css";

type SharePayload =
  | {
      type: "asset";
      sharedAt?: string;
      asset: LibraryItem;
    }
  | {
      type: "album";
      sharedAt?: string;
      album: { id: string; name: string; description?: string; createdAt?: string };
      items: LibraryItem[];
    };

function readTokenFromPath(pathname: string) {
  const [, prefix, token] = pathname.split("/");
  if (prefix !== "share" || !token) return "";
  return decodeURIComponent(token);
}

export function PublicSharePage() {
  const token = useMemo(() => readTokenFromPath(window.location.pathname), []);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<SharePayload | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [details, setDetails] = useState<Record<string, LibraryItem>>({});

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Invalid share link.");
      return;
    }

    let active = true;
    const load = async () => {
      try {
        setStatus("loading");
        const res = await fetch(`${apiOrigin}/api/public/shares/${encodeURIComponent(token)}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? "This share link is not available." : "Failed to load share.");
        }
        const data = (await res.json()) as SharePayload;
        if (!active) return;
        setShare(data);
        setStatus("ok");
      } catch (err) {
        if (!active) return;
        setStatus("error");
        setError((err as Error).message);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [token]);

  const items = useMemo(() => {
    if (!share) return [];
    return share.type === "asset" ? [share.asset] : share.items;
  }, [share]);

  const loadAssetDetail = useCallback(
    async (assetId: string) => {
      if (!token || details[assetId]) return;
      try {
        const res = await fetch(
          `${apiOrigin}/api/public/shares/${encodeURIComponent(token)}/assets/${assetId}?include=preview,original,thumb`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as LibraryItem;
        setDetails((prev) => ({ ...prev, [assetId]: data }));
      } catch {
        // keep thumbnail-only fallback
      }
    },
    [details, token],
  );

  const currentItem = viewerIndex === null ? null : items[viewerIndex] || null;
  const detailItem = currentItem ? details[currentItem.id] || currentItem : null;
  const thumbSrc = detailItem?.thumbUrl || null;
  const previewSrc = detailItem?.previewUrl || null;
  const originalSrc = detailItem?.originalUrl || null;
  const fallbackSrc = previewSrc || thumbSrc || originalSrc;
  const targetSrc = isFullscreen
    ? originalSrc || previewSrc
    : previewSrc || originalSrc;
  const [displaySrc, setDisplaySrc] = useState<string | null>(fallbackSrc);

  const rankSrc = useCallback(
    (src: string | null) => {
      if (!src) return 0;
      if (src === originalSrc) return 3;
      if (src === previewSrc) return 2;
      if (src === thumbSrc) return 1;
      return 0;
    },
    [originalSrc, previewSrc, thumbSrc],
  );

  useEffect(() => {
    if (!currentItem) return;
    void loadAssetDetail(currentItem.id);
  }, [currentItem, loadAssetDetail]);

  useEffect(() => {
    if (!targetSrc) {
      setDisplaySrc(fallbackSrc);
      return;
    }
    const img = new Image();
    img.src = targetSrc;
    if (img.complete) {
      setDisplaySrc(targetSrc);
      return;
    }
    setDisplaySrc(fallbackSrc);
  }, [currentItem?.id, fallbackSrc, targetSrc]);

  useLayoutEffect(() => {
    if (!targetSrc) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setDisplaySrc((prev) =>
        rankSrc(targetSrc) >= rankSrc(prev) ? targetSrc : prev,
      );
    };
    img.src = targetSrc;
    if (img.complete) {
      setDisplaySrc((prev) =>
        rankSrc(targetSrc) >= rankSrc(prev) ? targetSrc : prev,
      );
    }
    return () => {
      cancelled = true;
    };
  }, [targetSrc, rankSrc]);

  useEffect(() => {
    if (share?.type === "asset") {
      setViewerIndex(0);
    }
  }, [share]);

  useEffect(() => {
    if (viewerIndex === null && isFullscreen) {
      setIsFullscreen(false);
    }
  }, [isFullscreen, viewerIndex]);

  useEffect(() => {
    if (viewerIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (isFullscreen) {
          setIsFullscreen(false);
          return;
        }
        setViewerIndex(null);
        return;
      }

      if (share?.type !== "album") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setViewerIndex((prev) =>
          prev === null ? prev : Math.min(prev + 1, items.length - 1),
        );
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setViewerIndex((prev) => (prev === null ? prev : Math.max(prev - 1, 0)));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen, items.length, share?.type, viewerIndex]);

  if (status === "loading") {
    return (
      <main className="public-share-page">
        <h1>Open Photos</h1>
        <p>Loading shared content...</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="public-share-page">
        <h1>Open Photos</h1>
        <p>{error || "Unable to load this share link."}</p>
      </main>
    );
  }

  if (!share) {
    return null;
  }

  return (
    <main className="public-share-page">
      <header className="public-share-header">
        <h1>Open Photos</h1>
        <p className="public-share-subtitle">
          {share.type === "asset" ? "Shared photo" : share.album.name}
        </p>
      </header>

      {items.length > 0 && (
        <section className="public-share-grid">
          {items.map((item, index) => (
            <button
              key={item.id}
              className={`public-share-tile ${share.type === "asset" ? "single" : ""}`}
              onClick={() => setViewerIndex(index)}
              type="button"
            >
              {item.thumbUrl ? (
                <img className="public-share-image" src={item.thumbUrl} alt={item.filename || "photo"} />
              ) : (
                <div className="public-share-placeholder" />
              )}
            </button>
          ))}
        </section>
      )}

      {viewerIndex !== null && currentItem && (
        <div className="public-viewer" role="dialog" aria-modal="true">
          <button
            className="public-viewer-backdrop"
            onClick={() => {
              if (isFullscreen) {
                setIsFullscreen(false);
                return;
              }
              setViewerIndex(null);
            }}
            aria-label="Close viewer"
          />
          <div className={`public-viewer-content ${isFullscreen ? "fullscreen" : ""}`}>
            {!isFullscreen && (
              <div className="public-viewer-topbar">
                <div className="public-viewer-title">{currentItem.filename || "Shared photo"}</div>
                <div className="public-viewer-topbar-actions">
                  <button
                    className="public-viewer-close"
                    onClick={() => setIsFullscreen((prev) => !prev)}
                    type="button"
                  >
                    Full screen
                  </button>
                  <button
                    className="public-viewer-close"
                    onClick={() => setViewerIndex(null)}
                    type="button"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
            <div
              className={`public-viewer-frame ${isFullscreen ? "fullscreen" : ""}`}
              onClick={() => setIsFullscreen((prev) => !prev)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setIsFullscreen((prev) => !prev);
                }
              }}
            >
              {displaySrc ? (
                <div
                  className="public-viewer-image"
                  style={{ backgroundImage: `url("${displaySrc}")` }}
                  role="img"
                  aria-label={currentItem.filename || "photo"}
                />
              ) : (
                <div className="public-share-placeholder" />
              )}
            </div>
            {share.type === "album" && !isFullscreen && (
              <div className="public-viewer-actions">
                <button
                  className="button ghost"
                  onClick={() => setViewerIndex((prev) => (prev ? prev - 1 : 0))}
                  disabled={viewerIndex === 0}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="button"
                  onClick={() =>
                    setViewerIndex((prev) =>
                      prev === null ? prev : Math.min(prev + 1, items.length - 1),
                    )
                  }
                  disabled={viewerIndex === items.length - 1}
                  type="button"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

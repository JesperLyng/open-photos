import { useCallback, useEffect, useRef, useState } from "react";
import type { LibraryItem } from "../types/media";
import type { AuthState } from "./useAuth";

type UseViewerParams = {
  auth: AuthState;
  displayItems: LibraryItem[];
  fetchAsset: (
    token: string,
    assetId: string,
    include?: string[],
  ) => Promise<LibraryItem | null>;
};

export function useViewer({ auth, displayItems, fetchAsset }: UseViewerParams) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerAsset, setViewerAsset] = useState<LibraryItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const assetCacheRef = useRef<Map<string, LibraryItem>>(new Map());
  const requestCacheRef = useRef<Map<string, Promise<LibraryItem | null>>>(new Map());
  const prefetchedPreviewsRef = useRef<Set<string>>(new Set());
  const prefetchedOriginalsRef = useRef<Set<string>>(new Set());

  const currentItem = viewerIndex !== null ? displayItems[viewerIndex] : null;
  const detailItem = viewerAsset || currentItem;

  useEffect(() => {
    if (viewerIndex === null || auth.status !== "authenticated") {
      setViewerAsset(null);
      return;
    }
    const item = displayItems[viewerIndex];
    if (!item) {
      setViewerAsset(null);
      return;
    }

    setViewerAsset(item);
    const cached = assetCacheRef.current.get(item.id);
    if (cached) {
      setViewerAsset((prev) => (prev ? { ...prev, ...cached } : cached));
    }
  }, [viewerIndex, auth.status, displayItems]);

  useEffect(() => {
    let active = true;
    async function loadViewerAsset() {
      if (viewerIndex === null || auth.status !== "authenticated") {
        return;
      }
      const item = displayItems[viewerIndex];
      if (!item) {
        return;
      }

      const needsOriginal = isFullscreen;
      const needsPreview = !isFullscreen;
      const cached = assetCacheRef.current.get(item.id);
      if (needsOriginal && (viewerAsset?.originalUrl || cached?.originalUrl)) {
        if (cached) {
          setViewerAsset((prev) => (prev ? { ...prev, ...cached } : cached));
        }
        return;
      }
      if (needsPreview && (viewerAsset?.previewUrl || cached?.previewUrl)) {
        if (cached) {
          setViewerAsset((prev) => (prev ? { ...prev, ...cached } : cached));
        }
        return;
      }

      const include = needsOriginal ? ["original"] : ["preview"];
      const cacheKey = `${item.id}:${include[0]}`;

      try {
        let request = requestCacheRef.current.get(cacheKey);
        if (!request) {
          request = fetchAsset(auth.user.access_token, item.id, include);
          requestCacheRef.current.set(cacheKey, request);
        }
        const asset = await request;
        if (!active) return;
        if (asset) {
          const merged = { ...(cached || {}), ...asset };
          assetCacheRef.current.set(item.id, merged);
          setViewerAsset((prev) => (prev ? { ...prev, ...merged } : merged));
        }
        requestCacheRef.current.delete(cacheKey);
      } catch {
        requestCacheRef.current.delete(cacheKey);
        // ignore
      }
    }

    loadViewerAsset();
    return () => {
      active = false;
    };
  }, [
    viewerIndex,
    auth.status,
    auth.user?.access_token,
    displayItems,
    fetchAsset,
    isFullscreen,
    viewerAsset?.originalUrl,
    viewerAsset?.previewUrl,
  ]);

  useEffect(() => {
    if (viewerIndex === null || auth.status !== "authenticated") return;

    const useOriginal = isFullscreen;
    const cacheRef = useOriginal ? prefetchedOriginalsRef : prefetchedPreviewsRef;
    const include = useOriginal ? "original" : "preview";
    const token = auth.user.access_token;

    const preload = async (index: number) => {
      const item = displayItems[index];
      if (!item?.id) return;
      if (cacheRef.current.has(item.id)) return;
      cacheRef.current.add(item.id);

      const cached = assetCacheRef.current.get(item.id);
      let url = useOriginal
        ? cached?.originalUrl || item.originalUrl
        : cached?.previewUrl || item.previewUrl;
      if (!url) {
        try {
          const cacheKey = `${item.id}:${include}`;
          let request = requestCacheRef.current.get(cacheKey);
          if (!request) {
            request = fetchAsset(token, item.id, [include]);
            requestCacheRef.current.set(cacheKey, request);
          }
          const asset = await request;
          if (asset) {
            const merged = { ...(cached || {}), ...asset };
            assetCacheRef.current.set(item.id, merged);
            url = useOriginal ? merged.originalUrl : merged.previewUrl;
          }
          requestCacheRef.current.delete(cacheKey);
        } catch {
          requestCacheRef.current.delete(`${item.id}:${include}`);
          return;
        }
      }
      if (!url) return;
      const img = new Image();
      img.src = url;
    };

    for (let offset = 1; offset <= 3; offset += 1) {
      void preload(viewerIndex + offset);
      void preload(viewerIndex - offset);
    }
  }, [
    viewerIndex,
    auth.status,
    auth.user?.access_token,
    displayItems,
    fetchAsset,
    isFullscreen,
  ]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement && viewerRef.current) {
      await viewerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  return {
    viewerRef,
    viewerIndex,
    setViewerIndex,
    viewerAsset,
    setViewerAsset,
    currentItem,
    detailItem,
    isFullscreen,
    toggleFullscreen,
  };
}

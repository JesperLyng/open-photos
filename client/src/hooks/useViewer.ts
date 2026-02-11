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
  const prefetchedOriginalsRef = useRef<Set<string>>(new Set());

  const currentItem = viewerIndex !== null ? displayItems[viewerIndex] : null;
  const detailItem = viewerAsset || currentItem;

  useEffect(() => {
    let active = true;
    async function loadViewerAsset() {
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

      try {
        const asset = await fetchAsset(auth.user.access_token, item.id, ["preview"]);
        if (!active) return;
        if (asset) {
          setViewerAsset((prev) => (prev ? { ...prev, ...asset } : asset));
        }
      } catch {
        if (active) setViewerAsset(item);
      }
    }

    loadViewerAsset();
    return () => {
      active = false;
    };
  }, [viewerIndex, auth.status, auth.user?.access_token, displayItems, fetchAsset]);

  useEffect(() => {
    if (viewerIndex === null) return;
    const preload = (index: number) => {
      const item = displayItems[index];
      if (!item) return;
      const url = item.previewUrl || item.thumbUrl || item.originalUrl;
      if (!url) return;
      const img = new Image();
      img.src = url;
    };
    preload(viewerIndex);
    preload(viewerIndex + 1);
    preload(viewerIndex - 1);
  }, [viewerIndex, displayItems]);

  useEffect(() => {
    let active = true;
    if (viewerIndex === null || !isFullscreen || auth.status !== "authenticated") {
      return () => {
        active = false;
      };
    }
    if (viewerAsset?.originalUrl) {
      return () => {
        active = false;
      };
    }

    const item = displayItems[viewerIndex];
    if (!item) {
      return () => {
        active = false;
      };
    }

    const loadOriginal = async () => {
      try {
        const asset = await fetchAsset(auth.user.access_token, item.id, ["original"]);
        if (!active) return;
        if (asset) {
          setViewerAsset((prev) => (prev ? { ...prev, ...asset } : asset));
        }
      } catch {
        // ignore
      }
    };

    void loadOriginal();

    return () => {
      active = false;
    };
  }, [
    auth.status,
    auth.user?.access_token,
    displayItems,
    fetchAsset,
    isFullscreen,
    viewerAsset?.originalUrl,
    viewerIndex,
  ]);

  useEffect(() => {
    if (viewerIndex === null || !isFullscreen || auth.status !== "authenticated") return;

    const prefetchOriginal = async (index: number) => {
      const item = displayItems[index];
      if (!item?.id) return;
      if (prefetchedOriginalsRef.current.has(item.id)) return;
      prefetchedOriginalsRef.current.add(item.id);

      try {
        const asset = await fetchAsset(auth.user.access_token, item.id, ["original"]);
        const url = asset?.originalUrl;
        if (!url) return;
        const img = new Image();
        img.src = url;
      } catch {
        // ignore
      }
    };

    void prefetchOriginal(viewerIndex + 1);
    void prefetchOriginal(viewerIndex - 1);
  }, [auth.status, auth.user?.access_token, displayItems, fetchAsset, isFullscreen, viewerIndex]);

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

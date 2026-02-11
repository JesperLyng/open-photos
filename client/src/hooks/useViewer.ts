import { useCallback, useEffect, useRef, useState } from "react";
import type { LibraryItem } from "../types/media";
import type { AuthState } from "./useAuth";

type UseViewerParams = {
  auth: AuthState;
  displayItems: LibraryItem[];
  fetchAsset: (token: string, assetId: string) => Promise<LibraryItem | null>;
};

export function useViewer({ auth, displayItems, fetchAsset }: UseViewerParams) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerAsset, setViewerAsset] = useState<LibraryItem | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
        const asset = await fetchAsset(auth.user.access_token, item.id);
        if (!active) return;
        if (asset) setViewerAsset(asset);
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
      const url = item.originalUrl || item.thumbUrl;
      if (!url) return;
      const img = new Image();
      img.src = url;
    };
    preload(viewerIndex);
    preload(viewerIndex + 1);
    preload(viewerIndex - 1);
  }, [viewerIndex, displayItems]);

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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { groupByDate } from "../lib/layout";
import type { DateGroup, LibraryItem } from "../types/media";
import { apiOrigin } from "../lib/api";
import type { AuthState } from "./useAuth";

export type LibraryState = {
  status: string;
  items: LibraryItem[];
  nextCursor?: string | null;
  error?: string;
};

type UseLibraryParams = {
  auth: AuthState;
  gridWidth: number;
  filter: { from: string; to: string; tags: string; favoriteOnly: boolean; albumId: string | null };
};

export function useLibrary({ auth, gridWidth, filter }: UseLibraryParams) {
  const [library, setLibrary] = useState<LibraryState>({ status: "idle", items: [] });
  const wsRef = useRef<WebSocket | null>(null);

  const fetchLibrary = useCallback(async (token: string) => {
    const collected: LibraryItem[] = [];
    let cursor: string | null = null;
    let page = 0;

    while (true) {
      const query = new URLSearchParams({ limit: "200" });
      if (cursor) query.set("cursor", cursor);
      if (filter.from) query.set("from", filter.from);
      if (filter.to) query.set("to", filter.to);
      if (filter.tags.trim()) query.set("tags", filter.tags.trim());
      if (filter.favoriteOnly) query.set("favorite", "true");
      if (filter.albumId) query.set("albumId", filter.albumId);

      const res = await fetch(`${apiOrigin}/api/library?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        setLibrary({ status: "error", items: [], error: `API error (${res.status})` });
        return;
      }

      const data = await res.json();
      const batch = data.items || [];
      collected.push(...batch);
      cursor = data.nextCursor || null;
      page += 1;

      if (!cursor || batch.length === 0 || page > 50) break;
    }

    const seen = new Set<string>();
    const unique: LibraryItem[] = [];
    for (const item of collected) {
      if (!item?.id) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      unique.push(item);
    }

    setLibrary({ status: "ok", items: unique, nextCursor: cursor });
  }, [filter.from, filter.to, filter.tags, filter.favoriteOnly, filter.albumId]);

  const fetchAsset = useCallback(
    async (token: string, assetId: string, include: string[] = []) => {
      const query = new URLSearchParams();
      if (include.length > 0) {
        query.set("include", include.join(","));
      }

      const res = await fetch(
        `/api/assets/${assetId}${query.toString() ? `?${query.toString()}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        return null;
      }

      return res.json();
    },
    [],
  );

  const refreshLibrary = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    await fetchLibrary(auth.user.access_token);
  }, [auth, fetchLibrary]);

  useEffect(() => {
    let isMounted = true;

    async function loadLibrary() {
      if (auth.status !== "authenticated") {
        if (auth.status === "anonymous") {
          setLibrary({ status: "idle", items: [] });
        }
        return;
      }

      try {
        setLibrary((prev) => ({ ...prev, status: "loading" }));
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
  }, [auth, fetchLibrary]);

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
          const updated = await fetchAsset(auth.user.access_token, message.assetId, ["thumb"]);
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
  }, [auth, apiOrigin, fetchAsset]);

  const gridItems = useMemo(() => {
    const seen = new Set<string>();
    const unique: LibraryItem[] = [];
    for (const item of library.items) {
      if (!item?.id) continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      unique.push(item);
    }
    return unique;
  }, [library.items]);

  const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);

  useEffect(() => {
    let cancelled = false;
    const compute = () => {
      if (cancelled) return;
      setDateGroups(groupByDate(gridItems, gridWidth));
    };

    type IdleCallback = (deadline: { timeRemaining: () => number; didTimeout: boolean }) => void;
    type IdleOptions = { timeout?: number };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: IdleCallback, options?: IdleOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === "function") {
      const id = idleWindow.requestIdleCallback(compute, { timeout: 200 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(id);
      };
    }

    const timeout = window.setTimeout(compute, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [gridItems, gridWidth]);

  const displayItems = useMemo(() => {
    const seen = new Set<string>();
    const ordered: LibraryItem[] = [];
    for (const group of dateGroups) {
      for (const row of group.rows) {
        for (const tile of row.tiles) {
          if (seen.has(tile.item.id)) continue;
          seen.add(tile.item.id);
          ordered.push(tile.item);
        }
      }
    }
    return ordered;
  }, [dateGroups]);

  const indexById = useMemo(
    () => new Map(displayItems.map((item, index) => [item.id, index])),
    [displayItems],
  );

  const applyTagsToLibrary = useCallback((updates: Map<string, string[]>) => {
    if (updates.size === 0) return;
    setLibrary((prev) => {
      if (prev.status !== "ok") return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          updates.has(item.id) ? { ...item, tags: updates.get(item.id) } : item,
        ),
      };
    });
  }, []);

  const applyFavoritesToLibrary = useCallback((updates: Map<string, boolean>) => {
    if (updates.size === 0) return;
    setLibrary((prev) => {
      if (prev.status !== "ok") return prev;
      return {
        ...prev,
        items: prev.items.map((item) =>
          updates.has(item.id) ? { ...item, favorite: updates.get(item.id) } : item,
        ),
      };
    });
  }, []);

  return {
    library,
    gridItems,
    dateGroups,
    displayItems,
    indexById,
    refreshLibrary,
    fetchAsset,
    applyTagsToLibrary,
    applyFavoritesToLibrary,
  };
}

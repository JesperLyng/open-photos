import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from "react";
import { getUser, handleCallback, login, logout, signup } from "./auth/oidc";
import "./App.css";

type LibraryItem = {
  id: string;
  status: string;
  filename?: string;
  original?: { key?: string };
  derived?: { small?: { width?: number; height?: number } };
  thumbUrl?: string | null;
  originalUrl?: string | null;
  createdAt?: string;
  tags?: string[];
  metadata?: {
    capturedAt?: string;
    width?: number;
    height?: number;
    orientation?: number;
    exif?: Record<string, unknown>;
  };
};

type UploadStatus =
  | "queued"
  | "hashing"
  | "init"
  | "uploading"
  | "finalizing"
  | "done"
  | "duplicate"
  | "error";

type UploadItem = {
  id: string;
  name: string;
  status: UploadStatus;
  error?: string;
  progress?: number;
};

type LayoutTile = {
  item: LibraryItem;
  width: number;
  height: number;
};

type LayoutRow = {
  height: number;
  tiles: LayoutTile[];
};

type DateGroup = {
  key: string;
  label: string;
  items: LibraryItem[];
  rows: LayoutRow[];
};

function getOrientationTransform(orientation?: number) {
  switch (orientation) {
    case 2:
      return "scaleX(-1)";
    case 3:
      return "rotate(180deg)";
    case 4:
      return "scaleY(-1)";
    case 5:
      return "rotate(90deg) scaleX(-1)";
    case 6:
      return "rotate(90deg)";
    case 7:
      return "rotate(270deg) scaleX(-1)";
    case 8:
      return "rotate(270deg)";
    default:
      return "";
  }
}

function uploadWithProgress(
  url: string,
  contentType: string,
  file: File,
  onProgress: (value: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(percent);
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));
    xhr.send(file);
  });
}

function App() {
  const [auth, setAuth] = useState({ status: "loading" });
  const [library, setLibrary] = useState<{
    status: string;
    items: LibraryItem[];
    nextCursor?: string | null;
    error?: string;
  }>({ status: "idle", items: [] });
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
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerAsset, setViewerAsset] = useState<LibraryItem | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [bulkTagDraft, setBulkTagDraft] = useState("");
  const [lastViewedId, setLastViewedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const apiOrigin = import.meta.env.VITE_API_ORIGIN || "http://localhost:3000";
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadPanelOpen, setUploadPanelOpen] = useState(true);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState(0);

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

  const fetchLibrary = useCallback(async (token: string) => {
    const collected: LibraryItem[] = [];
    let cursor: string | null = null;
    let page = 0;

    while (true) {
      const query = new URLSearchParams({ limit: "200" });
      if (cursor) query.set("cursor", cursor);

      const res = await fetch(`/api/library?${query.toString()}`, {
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
  }, []);

  const fetchAsset = useCallback(async (token: string, assetId: string) => {
    const res = await fetch(`/api/assets/${assetId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    return res.json();
  }, []);

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

  const computeSHA256 = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }, []);

  const addUploads = useCallback((files: File[]) => {
    const tasks = files.map((file) => ({ id: crypto.randomUUID(), file }));
    setUploads((prev) => [
      ...tasks.map((task) => ({
        id: task.id,
        name: task.file.name,
        status: "queued" as UploadStatus,
      })),
      ...prev,
    ]);
    setUploadPanelOpen(true);
    return tasks;
  }, []);

  const updateUpload = useCallback((id: string, patch: Partial<UploadItem>) => {
    setUploads((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || auth.status !== "authenticated") return;
      const tasks = addUploads(files);

      try {
        for (const task of tasks) {
          updateUpload(task.id, { status: "hashing" });
          const checksum = await computeSHA256(task.file);
          updateUpload(task.id, { status: "init" });

          const initRes = await fetch("/api/uploads/init", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${auth.user.access_token}`,
            },
            body: JSON.stringify({
              filename: task.file.name,
              contentType: task.file.type || "application/octet-stream",
              size: task.file.size,
              checksum,
            }),
          });

          if (!initRes.ok) {
            updateUpload(task.id, {
              status: "error",
              error: `Init failed (${initRes.status})`,
            });
            continue;
          }

          const initData = await initRes.json();
          if (initData.duplicate) {
            updateUpload(task.id, { status: "duplicate", progress: 100 });
            continue;
          }

          updateUpload(task.id, { status: "uploading", progress: 0 });
          try {
            await uploadWithProgress(
              initData.uploadUrl,
              initData.contentType,
              task.file,
              (progress) => updateUpload(task.id, { progress }),
            );
          } catch (error) {
            updateUpload(task.id, {
              status: "error",
              error: (error as Error).message,
            });
            continue;
          }

          updateUpload(task.id, { status: "finalizing" });
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
            updateUpload(task.id, {
              status: "error",
              error: `Complete failed (${completeRes.status})`,
            });
            continue;
          }

          updateUpload(task.id, { status: "done", progress: 100 });
        }

        await fetchLibrary(auth.user.access_token);
      } catch (err) {
        const message = (err as Error).message;
        setUploads((prev) =>
          prev.map((item) =>
            ["queued", "hashing", "init", "uploading", "finalizing"].includes(item.status)
              ? { ...item, status: "error", error: message }
              : item,
          ),
        );
      }
    },
    [auth, addUploads, computeSHA256, fetchLibrary, updateUpload],
  );

  const handleUploadInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      event.target.value = "";
      void handleUploadFiles(files);
    },
    [handleUploadFiles],
  );

  function getItemDate(item: LibraryItem) {
    const dateSource = item.metadata?.capturedAt || item.createdAt;
    if (!dateSource) return null;
    const date = new Date(dateSource);
    return Number.isNaN(date.valueOf()) ? null : date;
  }

  function getItemRatio(item: LibraryItem) {
    const derivedWidth = item.derived?.small?.width;
    const derivedHeight = item.derived?.small?.height;
    if (derivedWidth && derivedHeight) {
      return { ratio: derivedWidth / derivedHeight, fromDerived: true };
    }

    const width = item.metadata?.width;
    const height = item.metadata?.height;
    if (width && height) return { ratio: width / height, fromDerived: false };

    return { ratio: 1, fromDerived: false };
  }

  function getDisplayRatio(item: LibraryItem) {
    const { ratio, fromDerived } = getItemRatio(item);
    const orientation = item.metadata?.orientation;
    if (!fromDerived && orientation && [5, 6, 7, 8].includes(orientation)) {
      return ratio > 0 ? 1 / ratio : ratio;
    }
    return ratio;
  }

  function buildRows(items: LibraryItem[], containerWidth: number): LayoutRow[] {
    const width = containerWidth || 1200;
    const gap = 6;
    const targetHeight = 140;
    const rows: LayoutRow[] = [];
    let row: { item: LibraryItem; ratio: number }[] = [];
    let ratioSum = 0;

    const flushRow = (rowItems: { item: LibraryItem; ratio: number }[], height: number) => {
      const tiles = rowItems.map((entry) => ({
        item: entry.item,
        width: Math.round(height * entry.ratio),
        height,
      }));
      const totalWidth =
        tiles.reduce((sum, tile) => sum + tile.width, 0) + gap * (tiles.length - 1);
      const diff = Math.round(width - totalWidth);
      if (tiles.length > 0 && Math.abs(diff) > 1) {
        tiles[tiles.length - 1].width = Math.max(40, tiles[tiles.length - 1].width + diff);
      }
      rows.push({ height, tiles });
    };

    for (const item of items) {
      const ratio = Math.max(0.5, Math.min(getDisplayRatio(item), 2.8));
      row.push({ item, ratio });
      ratioSum += ratio;

      const rowHeight = (width - gap * (row.length - 1)) / ratioSum;
      if (rowHeight <= targetHeight * 1.25) {
        if (rowHeight < targetHeight * 0.7 && row.length > 1) {
          const last = row.pop();
          if (last) ratioSum -= last.ratio;
          const adjustedHeight = (width - gap * (row.length - 1)) / ratioSum;
          flushRow(row, adjustedHeight);
          row = last ? [last] : [];
          ratioSum = last ? last.ratio : 0;
        } else {
          flushRow(row, rowHeight);
          row = [];
          ratioSum = 0;
        }
      }
    }

    if (row.length > 0) {
      const avgRatio = ratioSum / row.length;
      const estimatedCount = Math.max(
        row.length,
        Math.round(width / (targetHeight * avgRatio + gap)),
      );
      const ghostCount = Math.max(0, estimatedCount - row.length);
      const totalRatio = ratioSum + ghostCount * avgRatio;
      const totalGap = gap * (row.length + ghostCount - 1);
      const available = Math.max(0, width - totalGap);
      const naturalHeight = totalRatio > 0 ? available / totalRatio : targetHeight;
      const rowHeight = Math.min(targetHeight, Math.max(targetHeight * 0.7, naturalHeight));
      const tiles = row.map((entry) => ({
        item: entry.item,
        width: Math.round(rowHeight * entry.ratio),
        height: rowHeight,
      }));
      rows.push({ height: rowHeight, tiles });
    }

    return rows;
  }

  function groupByDate(items: LibraryItem[], containerWidth: number): DateGroup[] {
    const groups = new Map<string, { date: Date | null; label: string; items: LibraryItem[] }>();

    for (const item of items) {
      const date = getItemDate(item);
      const key = date ? date.toISOString().slice(0, 10) : "unknown";
      const label = date
        ? date.toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : "Unknown date";
      if (!groups.has(key)) {
        groups.set(key, { date, label, items: [] });
      }
      groups.get(key)?.items.push(item);
    }

    const sortedGroups = Array.from(groups.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.getTime() - a.date.getTime();
      });

    return sortedGroups.map((group) => {
      const sortedItems = group.items.slice().sort((a, b) => {
        const aDate = getItemDate(a)?.getTime() || 0;
        const bDate = getItemDate(b)?.getTime() || 0;
        if (aDate !== bDate) return bDate - aDate;
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bCreated - aCreated;
      });

      return {
        key: group.key,
        label: group.label,
        items: sortedItems,
        rows: buildRows(sortedItems, containerWidth),
      };
    });
  }

  const dateGroups = useMemo(
    () => groupByDate(gridItems, gridWidth),
    [gridItems, gridWidth],
  );
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

  const currentItem = viewerIndex !== null ? displayItems[viewerIndex] : null;
  const detailItem = viewerAsset || currentItem;
  const indexById = useMemo(
    () => new Map(displayItems.map((item, index) => [item.id, index])),
    [displayItems],
  );
  const uploadCounts = uploads.reduce(
    (acc, item) => {
      if (item.status === "done" || item.status === "duplicate") acc.completed += 1;
      else if (item.status === "error") acc.failed += 1;
      else acc.active += 1;
      return acc;
    },
    { active: 0, completed: 0, failed: 0 },
  );
  const showUploadPanel = uploads.length > 0;

  const selectedItems = useMemo(
    () => gridItems.filter((item) => selection.has(item.id)),
    [gridItems, selection],
  );

  const selectedTagSummary = useMemo(() => {
    if (selectedItems.length === 0) {
      return { common: [], mixed: [] };
    }
    const labelByKey = new Map<string, string>();
    let commonKeys: Set<string> | null = null;
    const unionKeys = new Set<string>();

    for (const item of selectedItems) {
      const tags = item.tags || [];
      const keys = new Set<string>();
      for (const tag of tags) {
        const key = normalizeTagKey(tag);
        if (!key) continue;
        keys.add(key);
        unionKeys.add(key);
        if (!labelByKey.has(key)) {
          labelByKey.set(key, sanitizeText(tag));
        }
      }
      if (commonKeys === null) {
        commonKeys = new Set(keys);
      } else {
        commonKeys = new Set(Array.from(commonKeys).filter((key) => keys.has(key)));
      }
    }

    const commonList = Array.from(commonKeys ?? []).map(
      (key) => labelByKey.get(key) || key,
    );
    const mixedList = Array.from(unionKeys)
      .filter((key) => !(commonKeys ?? new Set()).has(key))
      .map((key) => labelByKey.get(key) || key);

    return {
      common: commonList.sort((a, b) => a.localeCompare(b)),
      mixed: mixedList.sort((a, b) => a.localeCompare(b)),
    };
  }, [selectedItems]);

  const toggleSelect = useCallback(
    (index: number, event: MouseEvent) => {
      const isShift = event.shiftKey;
      const isToggle = event.ctrlKey || event.metaKey;
      const item = displayItems[index];
      if (!item) return;
      const shiftAnchor =
        lastSelectedIndex ??
        (selection.size === 0 && lastViewedId ? indexById.get(lastViewedId) ?? null : null);

      if (isShift) {
        if (shiftAnchor === null) {
          setSelection(new Set([item.id]));
          setLastSelectedIndex(index);
          return;
        }

        const start = Math.min(shiftAnchor, index);
        const end = Math.max(shiftAnchor, index);
        const next = new Set(selection);
        for (let i = start; i <= end; i += 1) {
          const id = displayItems[i]?.id;
          if (id) next.add(id);
        }
        setSelection(next);
        setLastSelectedIndex(index);
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
        setSelection(new Set());
        setLastSelectedIndex(null);
        setViewerIndex(index);
        return;
      }

      setViewerIndex(index);
    },
    [displayItems, indexById, lastSelectedIndex, lastViewedId, selection],
  );

  const clearSelection = useCallback(() => {
    setSelection(new Set());
    setLastSelectedIndex(null);
  }, []);

  const deleteSelected = useCallback(async () => {
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

    clearSelection();

    await fetchLibrary(auth.user.access_token);
  }, [auth, clearSelection, fetchLibrary, selection]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelection(new Set());
        setLastSelectedIndex(null);
        if (viewerIndex !== null) {
          setViewerIndex(null);
        }
        return;
      }
      if (viewerIndex === null) return;
      if (event.key === "ArrowRight") {
        setViewerIndex((prev) =>
          prev === null ? prev : Math.min(prev + 1, displayItems.length - 1),
        );
      }
      if (event.key === "ArrowLeft") {
        setViewerIndex((prev) => (prev === null ? prev : Math.max(prev - 1, 0)));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerIndex, displayItems.length]);

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
  }, [viewerIndex, auth.status, auth.user?.access_token, displayItems]);

  useEffect(() => {
    setTagDraft("");
  }, [viewerIndex]);

  useEffect(() => {
    if (viewerIndex === null) return;
    const item = displayItems[viewerIndex];
    if (item?.id) {
      setLastViewedId(item.id);
    }
  }, [viewerIndex, displayItems]);

  useEffect(() => {
    if (selection.size === 0) {
      setBulkTagDraft("");
    }
  }, [selection.size]);

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

  function sanitizeText(value: string) {
    return value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  }

  function normalizeTag(value: string) {
    const cleaned = sanitizeText(value);
    return cleaned.replace(/,+/g, " ").trim();
  }

  function normalizeTagKey(value: string) {
    return normalizeTag(value).toLowerCase();
  }

  function normalizeExifValue(value: unknown) {
    if (value == null) return null;
    if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
      if (typeof value === "string") return sanitizeText(value);
      return value;
    }
    if (Array.isArray(value)) {
      return value.length ? normalizeExifValue(value[0]) : null;
    }
    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      if ("value" in record) return normalizeExifValue(record.value);
      if ("numerator" in record && "denominator" in record) {
        const num = Number(record.numerator);
        const den = Number(record.denominator);
        if (!Number.isNaN(num) && !Number.isNaN(den) && den !== 0) {
          return num / den;
        }
      }
    }
    return null;
  }

  function readExif(exif: Record<string, unknown> | undefined, paths: string[]) {
    if (!exif) return null;
    for (const path of paths) {
      const parts = path.split(".");
      let current: unknown = exif;
      for (const part of parts) {
        if (!current || typeof current !== "object") {
          current = null;
          break;
        }
        current = (current as Record<string, unknown>)[part];
      }
      const normalized = normalizeExifValue(current);
      if (normalized !== null && normalized !== undefined) return normalized;
    }
    return null;
  }

  function formatExposure(value: unknown) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(numeric) || numeric <= 0) return null;
    if (numeric >= 1) return `${numeric.toFixed(1)}s`;
    return `1/${Math.round(1 / numeric)}s`;
  }

  function formatAperture(value: unknown) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(numeric) || numeric <= 0) return null;
    return `f/${numeric.toFixed(1)}`;
  }

  function formatFocalLength(value: unknown) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(numeric) || numeric <= 0) return null;
    return `${Math.round(numeric)} mm`;
  }

  function formatIso(value: unknown) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(numeric) || numeric <= 0) return null;
    return `ISO ${Math.round(numeric)}`;
  }

  function formatDate(value?: string) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function displayText(value: unknown) {
    if (value == null) return null;
    if (typeof value === "string") return sanitizeText(value);
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return null;
  }

  const updateTags = useCallback(
    async (nextTags: string[]) => {
      if (!detailItem || auth.status !== "authenticated") return;
      const assetId = detailItem.id;

      setViewerAsset((prev) => (prev ? { ...prev, tags: nextTags } : prev));
      setLibrary((prev) => {
        if (prev.status !== "ok") return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === assetId ? { ...item, tags: nextTags } : item,
          ),
        };
      });

      try {
        const res = await fetch(`/api/assets/${assetId}/tags`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.user.access_token}`,
          },
          body: JSON.stringify({ tags: nextTags }),
        });

        if (!res.ok) {
          throw new Error("Failed to save tags");
        }
      } catch (error) {
        console.error(error);
        const refreshed = await fetchAsset(auth.user.access_token, assetId);
        if (refreshed) {
          setViewerAsset(refreshed);
          setLibrary((prev) => {
            if (prev.status !== "ok") return prev;
            return {
              ...prev,
              items: prev.items.map((item) =>
                item.id === assetId ? { ...item, tags: refreshed.tags } : item,
              ),
            };
          });
        }
      }
    },
    [auth, detailItem, fetchAsset],
  );

  const applyTagUpdates = useCallback((updates: Map<string, string[]>) => {
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
    setViewerAsset((prev) => {
      if (!prev || !updates.has(prev.id)) return prev;
      return { ...prev, tags: updates.get(prev.id) };
    });
  }, []);

  const updateTagsForAssets = useCallback(
    async (updates: { id: string; tags: string[] }[]) => {
      if (updates.length === 0 || auth.status !== "authenticated") return;
      const map = new Map(updates.map((item) => [item.id, item.tags]));
      applyTagUpdates(map);

      const results = await Promise.allSettled(
        updates.map(async (item) => {
          const res = await fetch(`/api/assets/${item.id}/tags`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${auth.user.access_token}`,
            },
            body: JSON.stringify({ tags: item.tags }),
          });
          if (!res.ok) {
            throw new Error(`Failed to save tags for ${item.id}`);
          }
          return item.id;
        }),
      );

      const failed = results
        .map((result, index) => (result.status === "rejected" ? updates[index].id : null))
        .filter(Boolean) as string[];

      if (failed.length > 0) {
        for (const id of failed) {
          const refreshed = await fetchAsset(auth.user.access_token, id);
          if (refreshed) {
            applyTagUpdates(new Map([[id, refreshed.tags || []]]));
          }
        }
      }
    },
    [applyTagUpdates, auth, fetchAsset],
  );

  const handleBulkTagAdd = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (selectedItems.length === 0) return;
      const normalized = normalizeTag(bulkTagDraft);
      if (!normalized) return;

      const updates = selectedItems.map((item) => {
        const existing = item.tags || [];
        const existingKeys = new Set(existing.map((tag) => normalizeTagKey(tag)));
        if (existingKeys.has(normalizeTagKey(normalized))) {
          return { id: item.id, tags: existing };
        }
        return { id: item.id, tags: [...existing, normalized] };
      });

      void updateTagsForAssets(updates);
      setBulkTagDraft("");
    },
    [bulkTagDraft, selectedItems, updateTagsForAssets],
  );

  const handleBulkTagRemove = useCallback(
    (tag: string) => {
      if (selectedItems.length === 0) return;
      const key = normalizeTagKey(tag);
      if (!key) return;
      const updates = selectedItems.map((item) => {
        const next = (item.tags || []).filter((value) => normalizeTagKey(value) !== key);
        return { id: item.id, tags: next };
      });
      void updateTagsForAssets(updates);
    },
    [selectedItems, updateTagsForAssets],
  );

  const handleTagAdd = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (!detailItem) return;
      const normalized = normalizeTag(tagDraft);
      if (!normalized) return;
      const existing = detailItem.tags || [];
      const seen = new Set(existing.map((tag) => tag.toLowerCase()));
      if (seen.has(normalized.toLowerCase())) {
        setTagDraft("");
        return;
      }
      void updateTags([...existing, normalized]);
      setTagDraft("");
    },
    [detailItem, tagDraft, updateTags],
  );

  const handleTagRemove = useCallback(
    (tag: string) => {
      if (!detailItem) return;
      const next = (detailItem.tags || []).filter((item) => item !== tag);
      void updateTags(next);
    },
    [detailItem, updateTags],
  );

  useEffect(() => {
    if (!gridRef.current) return;
    const node = gridRef.current;
    const update = () => setGridWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(node);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  async function toggleFullscreen() {
    if (!document.fullscreenElement && viewerRef.current) {
      await viewerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }

  return (
    <div className="page">
      <Header
        auth={auth}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        menuRef={menuRef}
        handleUploadInput={handleUploadInput}
      />
      <LibraryGrid
        gridRef={gridRef}
        auth={auth}
        library={library}
        selection={selection}
        onDeleteSelected={deleteSelected}
        onClearSelection={clearSelection}
        selectedTags={selectedTagSummary}
        bulkTagDraft={bulkTagDraft}
        setBulkTagDraft={setBulkTagDraft}
        onBulkTagAdd={handleBulkTagAdd}
        onBulkTagRemove={handleBulkTagRemove}
        dateGroups={dateGroups}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        handleUploadFiles={handleUploadFiles}
        indexById={indexById}
        toggleSelect={toggleSelect}
      />

      {currentItem && (
        <div className="viewer" role="dialog" aria-modal="true" ref={viewerRef}>
          <button className="viewer-backdrop" onClick={() => setViewerIndex(null)} />
          <div className={`viewer-content ${isFullscreen ? "fullscreen" : ""}`}>
            <div className="viewer-topbar">
              {!isFullscreen && (
                <div className="viewer-tags">
                  <input
                    className="tag-input"
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={handleTagAdd}
                    placeholder="Add tag"
                  />
                  <div className="tag-list">
                    {(detailItem?.tags || []).map((tag) => (
                      <span key={tag} className="tag-pill">
                        {tag}
                      <button
                        className="tag-remove"
                        onClick={() => handleTagRemove(tag)}
                        aria-label={`Remove ${tag}`}
                        tabIndex={-1}
                      >
                        ×
                      </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="viewer-actions-inline">
                {!isFullscreen && (
                  <button className="viewer-close" onClick={() => setViewerIndex(null)}>
                    Close
                  </button>
                )}
                <button className="viewer-fullscreen" onClick={toggleFullscreen}>
                  {isFullscreen ? "Exit full screen" : "Full screen"}
                </button>
              </div>
            </div>
            <div className={`viewer-body ${isFullscreen ? "fullscreen" : ""}`}>
              {(() => {
                const transform = getOrientationTransform(detailItem?.metadata?.orientation);
                const imgStyle = transform
                  ? ({ "--img-transform": transform } as CSSProperties)
                  : undefined;
                return currentItem.thumbUrl ? (
                  <img
                    className="viewer-image"
                    src={currentItem.originalUrl || currentItem.thumbUrl}
                    alt={currentItem.filename || "asset"}
                    style={imgStyle}
                  />
                ) : (
                  <div className="viewer-image placeholder" />
                );
              })()}
              {!isFullscreen && (
                <aside className="viewer-panel">
                  <div className="viewer-panel-title">Details</div>
                  <div className="viewer-panel-item">
                    <span>Filename</span>
                    <strong>
                      {displayText(detailItem?.filename) ||
                        displayText(detailItem?.original?.key) ||
                        "-"}
                    </strong>
                  </div>
                  <div className="viewer-panel-item">
                    <span>Date taken</span>
                    <strong>
                      {formatDate(detailItem?.metadata?.capturedAt) ||
                        formatDate(detailItem?.createdAt) ||
                        "-"}
                    </strong>
                  </div>
                  <div className="viewer-panel-item">
                    <span>Camera</span>
                    <strong>
                      {displayText(
                        readExif(detailItem?.metadata?.exif, [
                          "image.Make",
                          "Image.Make",
                          "ifd0.Make",
                          "IFD0.Make",
                        ]),
                      ) ||
                        displayText(detailItem?.metadata?.cameraMake) ||
                        "-"}{" "}
                      {displayText(
                        readExif(detailItem?.metadata?.exif, [
                          "image.Model",
                          "Image.Model",
                          "ifd0.Model",
                          "IFD0.Model",
                        ]),
                      ) || displayText(detailItem?.metadata?.cameraModel) || ""}
                    </strong>
                  </div>
                  <div className="viewer-panel-item">
                    <span>Lens</span>
                    <strong>
                      {displayText(
                        readExif(detailItem?.metadata?.exif, [
                          "exif.LensModel",
                          "Exif.LensModel",
                          "photo.LensModel",
                          "Photo.LensModel",
                        ]),
                      ) || "-"}
                    </strong>
                  </div>
                  <div className="viewer-panel-item">
                    <span>Exposure</span>
                    <strong>
                      {formatExposure(
                        readExif(detailItem?.metadata?.exif, [
                          "exif.ExposureTime",
                          "Exif.ExposureTime",
                          "photo.ExposureTime",
                          "Photo.ExposureTime",
                        ]),
                      ) || "-"}
                    </strong>
                  </div>
                  <div className="viewer-panel-item">
                    <span>Aperture</span>
                    <strong>
                      {formatAperture(
                        readExif(detailItem?.metadata?.exif, [
                          "exif.FNumber",
                          "Exif.FNumber",
                          "photo.FNumber",
                          "Photo.FNumber",
                        ]),
                      ) || "-"}
                    </strong>
                  </div>
                  <div className="viewer-panel-item">
                    <span>ISO</span>
                    <strong>
                      {formatIso(
                        readExif(detailItem?.metadata?.exif, [
                          "exif.ISOSpeedRatings",
                          "Exif.ISOSpeedRatings",
                          "photo.ISOSpeedRatings",
                          "Photo.ISOSpeedRatings",
                        ]),
                      ) || "-"}
                    </strong>
                  </div>
                  <div className="viewer-panel-item">
                    <span>Focal length</span>
                    <strong>
                      {formatFocalLength(
                        readExif(detailItem?.metadata?.exif, [
                          "exif.FocalLength",
                          "Exif.FocalLength",
                          "photo.FocalLength",
                          "Photo.FocalLength",
                        ]),
                      ) || "-"}
                    </strong>
                  </div>
                  <div className="viewer-panel-item">
                    <span>Size</span>
                    <strong>
                      {detailItem?.metadata?.width && detailItem?.metadata?.height
                        ? `${detailItem?.metadata?.width} × ${detailItem?.metadata?.height}`
                        : "-"}
                    </strong>
                  </div>
                </aside>
              )}
            </div>
            {!isFullscreen && (
              <div className="viewer-actions">
                <button
                  className="button ghost light"
                  onClick={() => setViewerIndex((prev) => (prev ? prev - 1 : 0))}
                  disabled={viewerIndex === 0}
                >
                  Previous
                </button>
                <button
                  className="button"
                  onClick={() =>
                    setViewerIndex((prev) =>
                      prev === null ? prev : Math.min(prev + 1, displayItems.length - 1),
                    )
                  }
                  disabled={viewerIndex === displayItems.length - 1}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showUploadPanel && (
        <aside className={`upload-panel ${uploadPanelOpen ? "" : "collapsed"}`}>
          <div className="upload-header">
            <div className="upload-title">
              Uploads
              {(uploadCounts.active > 0 || uploadCounts.completed > 0) && (
                <span className="upload-count">
                  {uploadCounts.active} active · {uploadCounts.completed} done
                  {uploadCounts.failed > 0 ? ` · ${uploadCounts.failed} failed` : ""}
                </span>
              )}
            </div>
            <div className="upload-actions">
              <button
                className="upload-link"
                onClick={() =>
                  setUploads((prev) =>
                    prev.filter(
                      (item) => item.status !== "done" && item.status !== "duplicate",
                    ),
                  )
                }
              >
                Clear done
              </button>
              <button
                className="upload-link"
                onClick={() => setUploadPanelOpen((prev) => !prev)}
              >
                {uploadPanelOpen ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          {uploadPanelOpen && (
            <div className="upload-body">
              {uploads.map((item) => (
                <div key={item.id} className="upload-item">
                  <span className={`upload-dot ${item.status}`} />
                  <div className="upload-meta">
                    <div className="upload-name">{item.name}</div>
                    <div className="upload-status">
                      {item.status === "queued" && "Queued"}
                      {item.status === "hashing" && "Hashing"}
                      {item.status === "init" && "Preparing"}
                      {item.status === "uploading" &&
                        `Uploading${item.progress ? ` ${item.progress}%` : ""}`}
                      {item.status === "finalizing" && "Finalizing"}
                      {item.status === "done" && "Done"}
                      {item.status === "duplicate" && "Duplicate"}
                      {item.status === "error" && (item.error || "Failed")}
                    </div>
                    {item.status === "uploading" && (
                      <div className="upload-progress">
                        <div
                          className="upload-progress-bar"
                          style={{ width: `${item.progress || 0}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

export default App;

const Header = memo(function Header({
  auth,
  menuOpen,
  setMenuOpen,
  menuRef,
  handleUploadInput,
}: {
  auth: { status: string; user?: any; error?: string };
  menuOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  menuRef: RefObject<HTMLDivElement>;
  handleUploadInput: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
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
            onChange={handleUploadInput}
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
              {auth.status === "loading" && <div className="menu-item">Checking session...</div>}
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
                    {auth.user?.profile?.email || "Signed in"}
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
  );
});

const LibraryGrid = memo(function LibraryGrid({
  gridRef,
  auth,
  library,
  selection,
  onDeleteSelected,
  onClearSelection,
  selectedTags,
  bulkTagDraft,
  setBulkTagDraft,
  onBulkTagAdd,
  onBulkTagRemove,
  dateGroups,
  isDragging,
  setIsDragging,
  handleUploadFiles,
  indexById,
  toggleSelect,
}: {
  gridRef: RefObject<HTMLElement>;
  auth: { status: string };
  library: { status: string; items: LibraryItem[]; error?: string };
  selection: Set<string>;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  selectedTags: { common: string[]; mixed: string[] };
  bulkTagDraft: string;
  setBulkTagDraft: Dispatch<SetStateAction<string>>;
  onBulkTagAdd: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onBulkTagRemove: (tag: string) => void;
  dateGroups: DateGroup[];
  isDragging: boolean;
  setIsDragging: Dispatch<SetStateAction<boolean>>;
  handleUploadFiles: (files: File[]) => void;
  indexById: Map<string, number>;
  toggleSelect: (index: number, event: MouseEvent) => void;
}) {
  return (
    <section
      className="library-section"
      ref={gridRef}
      onClick={(event) => {
        if (selection.size === 0) return;
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target.closest(".photo-tile")) return;
        if (target.closest(".selection-bar")) return;
        onClearSelection();
      }}
    >
      {auth.status !== "authenticated" && <p>Sign in to upload files.</p>}
      {library.status === "idle" && <p>Sign in to view your library.</p>}
      {library.status === "error" && <p className="error">{library.error}</p>}
      {selection.size > 0 && (
        <div className="selection-bar" onClick={(event) => event.stopPropagation()}>
          <div className="selection-info">
            <div>{selection.size} selected</div>
            <div className="selection-tags">
              <input
                className="tag-input"
                value={bulkTagDraft}
                onChange={(event) => setBulkTagDraft(event.target.value)}
                onKeyDown={onBulkTagAdd}
                placeholder="Add tag"
              />
              <div className="tag-list">
                {selectedTags.common.map((tag) => (
                  <span key={`common-${tag}`} className="tag-pill">
                    {tag}
                    <button
                      className="tag-remove"
                      onClick={() => onBulkTagRemove(tag)}
                      aria-label={`Remove ${tag}`}
                      tabIndex={-1}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {selectedTags.mixed.map((tag) => (
                  <span key={`mixed-${tag}`} className="tag-pill muted">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button className="button ghost light" onClick={onDeleteSelected}>
            Delete
          </button>
        </div>
      )}
      {library.status === "ok" && library.items.length === 0 && <p>No assets yet.</p>}
      {library.status === "ok" && library.items.length > 0 && (
        <div className="year-groups">
          {dateGroups.map((group, groupIndex) => (
            <div key={`${group.key}-${groupIndex}`} className="year-group">
              <div className="year-header">{group.label}</div>
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
                  void handleUploadFiles(Array.from(files));
                }}
              >
                <div className="photo-grid">
                  {group.rows.map((row, rowIndex) => (
                    <div key={`${group.key}-${rowIndex}`} className="photo-row">
                      {row.tiles.map((tile) => {
                        const globalIndex = indexById.get(tile.item.id);
                        if (globalIndex === undefined) return null;
                        const transform = getOrientationTransform(tile.item.metadata?.orientation);
                        const imgStyle = transform
                          ? ({ "--img-transform": transform } as CSSProperties)
                          : undefined;
                        return (
                          <button
                            key={tile.item.id}
                            type="button"
                            className={`photo-tile ${
                              selection.has(tile.item.id) ? "selected" : ""
                            }`}
                            style={{ width: tile.width, height: tile.height }}
                            onClick={(event) => toggleSelect(globalIndex, event)}
                          >
                            {tile.item.thumbUrl ? (
                              <img
                                className="photo-img"
                                src={tile.item.thumbUrl}
                                alt={tile.item.filename || "asset"}
                                style={imgStyle}
                              />
                            ) : (
                              <div className="photo-img placeholder" />
                            )}
                            {tile.item.status !== "ready" && (
                              <div className="photo-status">{tile.item.status}</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
});

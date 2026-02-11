import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Dispatch,
  SetStateAction,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { LibraryItem } from "../types/media";
import { normalizeTag, normalizeTagKey, sanitizeText } from "../lib/tags";
import type { AuthState } from "./useAuth";

type UseTagsParams = {
  auth: AuthState;
  detailItem: LibraryItem | null;
  selectedItems: LibraryItem[];
  fetchAsset: (token: string, assetId: string) => Promise<LibraryItem | null>;
  applyTagsToLibrary: (updates: Map<string, string[]>) => void;
  setViewerAsset: Dispatch<SetStateAction<LibraryItem | null>>;
};

export function useTags({
  auth,
  detailItem,
  selectedItems,
  fetchAsset,
  applyTagsToLibrary,
  setViewerAsset,
}: UseTagsParams) {
  const [tagDraft, setTagDraft] = useState("");
  const [bulkTagDraft, setBulkTagDraft] = useState("");

  useEffect(() => {
    setTagDraft("");
  }, [detailItem?.id]);

  useEffect(() => {
    if (selectedItems.length === 0) {
      setBulkTagDraft("");
    }
  }, [selectedItems.length]);

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

  const updateTags = useCallback(
    async (assetId: string, nextTags: string[]) => {
      if (auth.status !== "authenticated") return;

      if (detailItem?.id === assetId) {
        setViewerAsset((prev) => (prev ? { ...prev, tags: nextTags } : prev));
      }
      applyTagsToLibrary(new Map([[assetId, nextTags]]));

      let failed = false;
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
          failed = true;
          console.error("Failed to save tags");
        }
      } catch (error) {
        failed = true;
        console.error(error);
      }

      if (failed) {
        const refreshed = await fetchAsset(auth.user.access_token, assetId);
        if (refreshed) {
          applyTagsToLibrary(new Map([[assetId, refreshed.tags || []]]));
          if (detailItem?.id === assetId) {
            setViewerAsset(refreshed);
          }
        }
      }
    },
    [applyTagsToLibrary, auth, detailItem, fetchAsset, setViewerAsset],
  );

  const updateTagsForAssets = useCallback(
    async (updates: { id: string; tags: string[] }[]) => {
      if (updates.length === 0 || auth.status !== "authenticated") return;
      const map = new Map(updates.map((item) => [item.id, item.tags]));
      applyTagsToLibrary(map);
      if (detailItem?.id && map.has(detailItem.id)) {
        setViewerAsset((prev) => (prev ? { ...prev, tags: map.get(detailItem.id) } : prev));
      }

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
            applyTagsToLibrary(new Map([[id, refreshed.tags || []]]));
            if (detailItem?.id === id) {
              setViewerAsset(refreshed);
            }
          }
        }
      }
    },
    [applyTagsToLibrary, auth, detailItem, fetchAsset, setViewerAsset],
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

  const handleBulkTagApply = useCallback(
    (tag: string) => {
      if (selectedItems.length === 0) return;
      const normalized = normalizeTag(tag);
      if (!normalized) return;

      const updates = selectedItems.map((item) => {
        const existing = item.tags || [];
        const existingKeys = new Set(existing.map((value) => normalizeTagKey(value)));
        if (existingKeys.has(normalizeTagKey(normalized))) {
          return { id: item.id, tags: existing };
        }
        return { id: item.id, tags: [...existing, normalized] };
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
      void updateTags(detailItem.id, [...existing, normalized]);
      setTagDraft("");
    },
    [detailItem, tagDraft, updateTags],
  );

  const handleTagRemove = useCallback(
    (tag: string) => {
      if (!detailItem) return;
      const next = (detailItem.tags || []).filter((item) => item !== tag);
      void updateTags(detailItem.id, next);
    },
    [detailItem, updateTags],
  );

  return {
    tagDraft,
    setTagDraft,
    bulkTagDraft,
    setBulkTagDraft,
    selectedTagSummary,
    handleTagAdd,
    handleTagRemove,
    handleBulkTagAdd,
    handleBulkTagRemove,
    handleBulkTagApply,
  };
}

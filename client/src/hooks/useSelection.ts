import { useCallback, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { LibraryItem } from "../types/media";

type UseSelectionParams = {
  displayItems: LibraryItem[];
  gridItems: LibraryItem[];
  indexById: Map<string, number>;
  lastViewedId: string | null;
  onOpen: (index: number) => void;
};

export function useSelection({
  displayItems,
  gridItems,
  indexById,
  lastViewedId,
  onOpen,
}: UseSelectionParams) {
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const selectedItems = useMemo(
    () => gridItems.filter((item) => selection.has(item.id)),
    [gridItems, selection],
  );

  const clearSelection = useCallback(() => {
    setSelection(new Set());
    setLastSelectedIndex(null);
  }, []);

  const toggleSelect = useCallback(
    (index: number, event: ReactMouseEvent) => {
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
        clearSelection();
        onOpen(index);
        return;
      }

      onOpen(index);
    },
    [clearSelection, displayItems, indexById, lastSelectedIndex, lastViewedId, onOpen, selection],
  );

  return {
    selection,
    setSelection,
    lastSelectedIndex,
    setLastSelectedIndex,
    selectedItems,
    clearSelection,
    toggleSelect,
  };
}

import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "./components/Header";
import { LibraryGrid } from "./components/LibraryGrid";
import { UploadPanel } from "./components/UploadPanel";
import { Viewer } from "./components/Viewer";
import { useAuth } from "./hooks/useAuth";
import { useElementWidth } from "./hooks/useElementWidth";
import { useLibrary } from "./hooks/useLibrary";
import { useSelection } from "./hooks/useSelection";
import { useTags } from "./hooks/useTags";
import { useUploads } from "./hooks/useUploads";
import { useViewer } from "./hooks/useViewer";
import { normalizeTag, normalizeTagKey } from "./lib/tags";
import "./App.css";

function App() {
  const auth = useAuth();
  const apiOrigin = import.meta.env.VITE_API_ORIGIN || "http://localhost:3000";
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState({ from: "", to: "", tags: [] as string[] });
  const [filterTagDraft, setFilterTagDraft] = useState("");
  const [activeFilter, setActiveFilter] = useState({ from: "", to: "", tags: "" });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const gridWidth = useElementWidth(gridRef);

  const {
    library,
    gridItems,
    dateGroups,
    displayItems,
    indexById,
    refreshLibrary,
    fetchAsset,
    applyTagsToLibrary,
  } = useLibrary({ auth, apiOrigin, gridWidth, filter: activeFilter });

  const {
    viewerRef,
    viewerIndex,
    setViewerIndex,
    setViewerAsset,
    currentItem,
    detailItem,
    isFullscreen,
    toggleFullscreen,
  } = useViewer({ auth, displayItems, fetchAsset });

  const [lastViewedId, setLastViewedId] = useState<string | null>(null);

  const setViewerIndexWithLast = useCallback(
    (next: number | null | ((prev: number | null) => number | null)) => {
      setViewerIndex((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        if (resolved !== null) {
          const item = displayItems[resolved];
          if (item?.id) {
            setLastViewedId(item.id);
          }
        }
        return resolved;
      });
    },
    [displayItems, setViewerIndex],
  );

  const {
    selection,
    selectedItems,
    clearSelection,
    toggleSelect,
  } = useSelection({
    displayItems,
    gridItems,
    indexById,
    lastViewedId,
    onOpen: (index) => setViewerIndexWithLast(index),
  });

  const {
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
  } = useTags({
    auth,
    detailItem,
    selectedItems,
    fetchAsset,
    applyTagsToLibrary,
    setViewerAsset,
  });

  const {
    uploads,
    setUploads,
    uploadPanelOpen,
    setUploadPanelOpen,
    handleUploadFiles,
    handleUploadInput,
  } = useUploads({ auth, refreshLibrary });

  const [isDragging, setIsDragging] = useState(false);

  const deleteSelected = useCallback(async () => {
    if (selection.size === 0 || auth.status !== "authenticated") return;
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
    await refreshLibrary();
  }, [auth, clearSelection, refreshLibrary, selection]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        clearSelection();
        if (viewerIndex !== null) {
          setViewerIndexWithLast(null);
        }
        return;
      }
      if (viewerIndex === null) return;
      if (event.key === "ArrowRight") {
        setViewerIndexWithLast((prev) =>
          prev === null ? prev : Math.min(prev + 1, displayItems.length - 1),
        );
      }
      if (event.key === "ArrowLeft") {
        setViewerIndexWithLast((prev) => (prev === null ? prev : Math.max(prev - 1, 0)));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, displayItems.length, viewerIndex, setViewerIndexWithLast]);

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

  const showUploadPanel = uploads.length > 0;
  const filterActive = Boolean(activeFilter.from || activeFilter.to || activeFilter.tags.trim());

  const handleFilterTagAdd = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const normalized = normalizeTag(filterTagDraft);
      if (!normalized) return;
      const key = normalizeTagKey(normalized);

      setFilterDraft((prev) => {
        if (prev.tags.some((tag) => normalizeTagKey(tag) === key)) {
          return prev;
        }
        return { ...prev, tags: [...prev.tags, normalized] };
      });
      setFilterTagDraft("");
    },
    [filterTagDraft],
  );

  return (
    <div className="page">
      <Header
        auth={auth}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        menuRef={menuRef}
        onUploadInput={handleUploadInput}
        onFilterClick={() => {
          const tags = activeFilter.tags
            ? activeFilter.tags
                .split(",")
                .map((tag) => normalizeTag(tag))
                .filter(Boolean)
            : [];
          setFilterDraft({ from: activeFilter.from, to: activeFilter.to, tags });
          setFilterTagDraft("");
          setFilterOpen(true);
        }}
        filterActive={filterActive}
      />
      {filterOpen && (
        <div className="filter-dialog" role="dialog" aria-modal="true">
          <button
            className="filter-backdrop"
            onClick={() => setFilterOpen(false)}
            aria-label="Close filters"
          />
          <div className="filter-panel">
            <div className="filter-header">
              <div className="filter-title">Filter photos</div>
              <button className="filter-close" onClick={() => setFilterOpen(false)}>
                Close
              </button>
            </div>
            <div className="filter-fields">
              <label className="filter-field">
                <span>From</span>
                <input
                  type="datetime-local"
                  value={filterDraft.from}
                  onChange={(event) =>
                    setFilterDraft((prev) => ({ ...prev, from: event.target.value }))
                  }
                />
              </label>
              <label className="filter-field">
                <span>To</span>
                <input
                  type="datetime-local"
                  value={filterDraft.to}
                  onChange={(event) =>
                    setFilterDraft((prev) => ({ ...prev, to: event.target.value }))
                  }
                />
              </label>
              <div className="filter-field">
                <span>Tags (all)</span>
                <div className="filter-tag-editor">
                  <input
                    type="text"
                    className="filter-tag-input"
                    placeholder="Add tag and press Enter"
                    value={filterTagDraft}
                    onChange={(event) => setFilterTagDraft(event.target.value)}
                    onKeyDown={handleFilterTagAdd}
                  />
                  <div className="filter-tag-list">
                    {filterDraft.tags.map((tag) => (
                      <span key={`filter-${tag}`} className="filter-tag-pill">
                        {tag}
                        <button
                          className="filter-tag-remove"
                          onClick={() =>
                            setFilterDraft((prev) => ({
                              ...prev,
                              tags: prev.tags.filter((item) => item !== tag),
                            }))
                          }
                          aria-label={`Remove ${tag}`}
                          tabIndex={-1}
                          type="button"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="filter-hint">Photos must match all selected tags.</div>
              </div>
            </div>
            <div className="filter-actions">
              <button
                className="button ghost"
                onClick={() => {
                  setFilterDraft({ from: "", to: "", tags: [] });
                  setFilterTagDraft("");
                  setActiveFilter({ from: "", to: "", tags: "" });
                  setFilterOpen(false);
                }}
              >
                Clear
              </button>
              <button className="button ghost" onClick={() => setFilterOpen(false)}>
                Cancel
              </button>
              <button
                className="button"
                onClick={() => {
                  setActiveFilter({
                    from: filterDraft.from,
                    to: filterDraft.to,
                    tags: filterDraft.tags.join(", "),
                  });
                  setFilterOpen(false);
                }}
              >
                Filter
              </button>
            </div>
          </div>
        </div>
      )}
      <LibraryGrid
        gridRef={gridRef}
        authStatus={auth.status}
        library={library}
        selection={selection}
        onDeleteSelected={deleteSelected}
        onClearSelection={clearSelection}
        selectedTags={selectedTagSummary}
        bulkTagDraft={bulkTagDraft}
        setBulkTagDraft={setBulkTagDraft}
        onBulkTagAdd={handleBulkTagAdd}
        onBulkTagRemove={handleBulkTagRemove}
        onBulkTagApply={handleBulkTagApply}
        dateGroups={dateGroups}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        handleUploadFiles={handleUploadFiles}
        indexById={indexById}
        toggleSelect={toggleSelect}
      />

      {currentItem && (
        <Viewer
          viewerRef={viewerRef}
          currentItem={currentItem}
          detailItem={detailItem}
          viewerIndex={viewerIndex ?? 0}
          totalCount={displayItems.length}
          isFullscreen={isFullscreen}
          onClose={() => setViewerIndexWithLast(null)}
          onToggleFullscreen={toggleFullscreen}
          onPrev={() => setViewerIndexWithLast((prev) => (prev ? prev - 1 : 0))}
          onNext={() =>
            setViewerIndexWithLast((prev) =>
              prev === null ? prev : Math.min(prev + 1, displayItems.length - 1),
            )
          }
          tagDraft={tagDraft}
          setTagDraft={setTagDraft}
          onTagAdd={handleTagAdd}
          onTagRemove={handleTagRemove}
        />
      )}

      {showUploadPanel && (
        <UploadPanel
          uploads={uploads}
          uploadPanelOpen={uploadPanelOpen}
          setUploadPanelOpen={setUploadPanelOpen}
          onClearDone={() =>
            setUploads((prev) =>
              prev.filter((item) => item.status !== "done" && item.status !== "duplicate"),
            )
          }
        />
      )}
    </div>
  );
}

export default App;

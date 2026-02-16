import type {KeyboardEvent as ReactKeyboardEvent} from "react";
import {useCallback, useEffect, useRef, useState} from "react";
import {Header} from "./components/Header";
import {LibraryGrid} from "./components/LibraryGrid";
import {UploadPanel} from "./components/UploadPanel";
import {Viewer} from "./components/Viewer";
import {useAuth} from "./hooks/useAuth";
import {useElementWidth} from "./hooks/useElementWidth";
import {useLibrary} from "./hooks/useLibrary";
import {useSelection} from "./hooks/useSelection";
import {useTags} from "./hooks/useTags";
import {useUploads} from "./hooks/useUploads";
import {useViewer} from "./hooks/useViewer";
import {normalizeTag, normalizeTagKey} from "./lib/tags";
import type {Album} from "./types/album";
import {apiOrigin} from "./lib/api";
import "./App.css";

function App() {
  const auth = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState({ from: "", to: "", tags: [] as string[] });
  const [filterTagDraft, setFilterTagDraft] = useState("");
  const [activeFilter, setActiveFilter] = useState({
    from: "",
    to: "",
    tags: "",
    favoriteOnly: false,
    albumId: null as string | null,
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumsStatus, setAlbumsStatus] = useState("idle");
  const [newAlbumName, setNewAlbumName] = useState("");
  const [albumPickerOpen, setAlbumPickerOpen] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<
    { key: string; label: string; count?: number }[]
  >([]);
  const [tagSuggestionsStatus, setTagSuggestionsStatus] = useState("idle");
  const menuRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const gridWidth = useElementWidth(gridRef);

  const {
    library,
    gridItems,
    importingItems,
    dateGroups,
    displayItems,
    indexById,
    refreshLibrary,
    fetchAsset,
    applyTagsToLibrary,
    applyFavoritesToLibrary,
  } = useLibrary({ auth, gridWidth, filter: activeFilter });

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
  const selectionFavoriteActive =
    selectedItems.length > 0 && selectedItems.every((item) => item.favorite);
  const selectionFavoriteLabel = selectionFavoriteActive
    ? "Remove favorites"
    : "Mark as favorite";

  const refreshAlbums = useCallback(async () => {
    if (auth.status !== "authenticated") {
      setAlbums([]);
      setAlbumsStatus("idle");
      return;
    }
    try {
      setAlbumsStatus("loading");
      const res = await fetch(`${apiOrigin}/api/albums`, {
        headers: {
          Authorization: `Bearer ${auth.user?.access_token}`,
        },
      });
      if (!res.ok) {
        console.error("Failed to load albums");
        setAlbumsStatus("error");
        return;
      }
      const data = await res.json();
      setAlbums(Array.isArray(data.items) ? data.items : []);
      setAlbumsStatus("ok");
    } catch (error) {
      console.error(error);
      setAlbumsStatus("error");
    }
  }, [auth.status, auth.user?.access_token]);

  useEffect(() => {
    void refreshAlbums();
  }, [refreshAlbums]);

  const createAlbum = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    const name = newAlbumName.trim();
    if (!name) return;
    try {
      const res = await fetch(`${apiOrigin}/api/albums`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.user?.access_token}`,
        },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        console.error("Failed to create album");
        return;
      }
      const data = await res.json();
      if (data?.album) {
        setAlbums((prev) => [data.album, ...prev]);
      }
      setNewAlbumName("");
    } catch (error) {
      console.error(error);
    }
  }, [auth.status, auth.user?.access_token, newAlbumName]);

  const deleteAlbum = useCallback(
    async (albumId: string) => {
      if (auth.status !== "authenticated") return;
      if (!window.confirm("Delete this album?")) return;
      try {
        const res = await fetch(`${apiOrigin}/api/albums/${albumId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${auth.user?.access_token}`,
          },
        });
        if (!res.ok) {
          console.error("Failed to delete album");
          return;
        }
        setAlbums((prev) => prev.filter((album) => album.id !== albumId));
        if (activeFilter.albumId === albumId) {
          setActiveFilter((prev) => ({ ...prev, albumId: null }));
          await refreshLibrary();
        }
      } catch (error) {
        console.error(error);
      }
    },
    [activeFilter.albumId, auth.status, auth.user?.access_token, refreshLibrary],
  );

  const addSelectionToAlbum = useCallback(
    async (albumId: string) => {
      if (auth.status !== "authenticated" || selectedItems.length === 0) return;
      const ids = selectedItems.map((item) => item.id);
      try {
        const res = await fetch(`${apiOrigin}/api/albums/${albumId}/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.user?.access_token}`,
          },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) {
          console.error("Failed to add to album");
          return;
        }
        if (activeFilter.albumId === albumId) {
          await refreshLibrary();
        }
      } catch (error) {
        console.error(error);
      }
    },
    [activeFilter.albumId, auth.status, auth.user?.access_token, refreshLibrary, selectedItems],
  );

  const removeSelectionFromAlbum = useCallback(async () => {
    if (
      auth.status !== "authenticated" ||
      selectedItems.length === 0 ||
      !activeFilter.albumId
    ) {
      return;
    }
    const ids = selectedItems.map((item) => item.id);
    try {
      const res = await fetch(`${apiOrigin}/api/albums/${activeFilter.albumId}/items`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.user?.access_token}`,
        },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        console.error("Failed to remove from album");
        return;
      }
      await refreshLibrary();
    } catch (error) {
      console.error(error);
    }
  }, [activeFilter.albumId, auth.status, auth.user?.access_token, refreshLibrary, selectedItems]);

  const updateFavorite = useCallback(
    async (assetId: string, favorite: boolean) => {
      if (auth.status !== "authenticated") return;

      applyFavoritesToLibrary(new Map([[assetId, favorite]]));
      if (detailItem?.id === assetId) {
        setViewerAsset((prev) => (prev ? { ...prev, favorite } : prev));
      }

      let failed = false;
      try {
        const res = await fetch(`${apiOrigin}/api/assets/${assetId}/favorite`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.user?.access_token}`,
          },
          body: JSON.stringify({ favorite }),
        });

        if (!res.ok) {
          console.error("Failed to save favorite");
          failed = true;
        }
      } catch (error) {
        console.error(error);
        failed = true;
      }

      if (failed) {
        const refreshed = auth.user ? await fetchAsset(auth.user.access_token, assetId, ["thumb"]) : false;
        if (refreshed) {
          applyFavoritesToLibrary(new Map([[assetId, Boolean(refreshed.favorite)]]));
          if (detailItem?.id === assetId) {
            setViewerAsset((prev) =>
              prev ? { ...prev, favorite: Boolean(refreshed.favorite) } : prev,
            );
          }
        }
      }
    },
    [
      applyFavoritesToLibrary,
      auth,
      detailItem?.id,
      fetchAsset,
      setViewerAsset,
    ],
  );

  const toggleFavoritesSelected = useCallback(async () => {
    if (selectedItems.length === 0 || auth.status !== "authenticated") return;
    const favorite = !selectionFavoriteActive;
    const ids = selectedItems.map((item) => item.id);

    applyFavoritesToLibrary(new Map(ids.map((id) => [id, favorite])));
    if (detailItem?.id && ids.includes(detailItem.id)) {
      setViewerAsset((prev) => (prev ? { ...prev, favorite } : prev));
    }

    let failed = false;
    try {
      const res = await fetch(`${apiOrigin}/api/assets/favorites`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.user?.access_token}`,
        },
        body: JSON.stringify({ ids, favorite }),
      });
      if (!res.ok) {
        console.error("Failed to save favorites");
        failed = true;
      }
    } catch (error) {
      console.error(error);
      failed = true;
    }
    if (failed) {
      await refreshLibrary();
    }
  }, [
    applyFavoritesToLibrary,
    auth,
    detailItem?.id,
    refreshLibrary,
    selectedItems,
    selectionFavoriteActive,
    setViewerAsset,
  ]);

  const deleteSelected = useCallback(async () => {
    if (selection.size === 0 || auth.status !== "authenticated") return;
    if (!window.confirm(`Delete ${selection.size} photo(s)?`)) return;

    const ids = Array.from(selection);
    await Promise.all(
      ids.map((id) =>
        fetch(`${apiOrigin}/api/assets/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${auth.user?.access_token}`,
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
  const isImporting = uploads.some((u) =>
    ["queued", "hashing", "init", "ready", "uploading", "finalizing"].includes(u.status),
  ) || importingItems.length > 0;
  const filterActive = Boolean(activeFilter.from || activeFilter.to || activeFilter.tags.trim());
  const tagSuggestionQuery = normalizeTagKey(filterTagDraft);
  const selectedTagKeys = new Set(filterDraft.tags.map((tag) => normalizeTagKey(tag)));
  const filteredTagSuggestions = tagSuggestions
    .filter((tag) => !selectedTagKeys.has(tag.key))
    .filter((tag) =>
      tagSuggestionQuery
        ? tag.key.includes(tagSuggestionQuery) ||
          tag.label.toLowerCase().includes(tagSuggestionQuery)
        : true,
    )
    .slice(0, 8);

  const addFilterTag = useCallback((value: string) => {
    const normalized = normalizeTag(value);
    if (!normalized) return;
    const key = normalizeTagKey(normalized);
    setFilterDraft((prev) => {
      if (prev.tags.some((tag) => normalizeTagKey(tag) === key)) {
        return prev;
      }
      return { ...prev, tags: [...prev.tags, normalized] };
    });
  }, []);

  const handleFilterTagAdd = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addFilterTag(filterTagDraft);
      setFilterTagDraft("");
    },
    [addFilterTag, filterTagDraft],
  );

  useEffect(() => {
    const loadSuggestions = async () => {
      if (auth.status !== "authenticated" || !filterOpen) return;
      try {
        setTagSuggestionsStatus("loading");
        const res = await fetch(`${apiOrigin}/api/tags`, {
          headers: {
            Authorization: `Bearer ${auth.user?.access_token}`,
          },
        });
        if (!res.ok) {
          console.error("Failed to load tags");
          setTagSuggestionsStatus("error");
          return;
        }
        const data = await res.json();
        setTagSuggestions(Array.isArray(data.items) ? data.items : []);
        setTagSuggestionsStatus("ok");
      } catch (error) {
        console.error(error);
        setTagSuggestionsStatus("error");
      }
    };

    void loadSuggestions();
  }, [auth.status, auth.user?.access_token, filterOpen]);

  return (
    <div
      className={`page ${isDragging ? "dragging" : ""}`}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return;
        void handleUploadFiles(Array.from(files));
      }}
    >
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
        onToggleFavoriteFilter={() =>
          setActiveFilter((prev) => ({ ...prev, favoriteOnly: !prev.favoriteOnly }))
        }
        favoriteFilterActive={activeFilter.favoriteOnly}
      />
      <div className="main-layout">
        <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
          <div className="sidebar-header">
            <div className="sidebar-title">Library</div>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              type="button"
            >
              {sidebarCollapsed ? ">" : "<"}
            </button>
          </div>
          <div className="sidebar-section">
            <button
              className={`sidebar-item ${
                !activeFilter.albumId && !activeFilter.favoriteOnly ? "active" : ""
              }`}
              onClick={() =>
                setActiveFilter((prev) => ({ ...prev, albumId: null, favoriteOnly: false }))
              }
              type="button"
            >
              <span className="sidebar-label">
                {sidebarCollapsed ? "A" : "All photos"}
              </span>
            </button>
            <button
              className={`sidebar-item ${activeFilter.favoriteOnly ? "active" : ""}`}
              onClick={() =>
                setActiveFilter((prev) => ({ ...prev, favoriteOnly: !prev.favoriteOnly }))
              }
              type="button"
            >
              <span className="sidebar-label">
                {sidebarCollapsed ? "F" : "Favorites"}
              </span>
            </button>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-section-title">Albums</div>
            {albumsStatus === "loading" && <div className="sidebar-muted">Loading...</div>}
            {albumsStatus === "error" && <div className="sidebar-muted">Failed to load.</div>}
            <div className="album-list">
              {albums.map((album) => {
                const label = sidebarCollapsed
                  ? album.name.slice(0, 1).toUpperCase()
                  : album.name;
                return (
                  <div
                    key={album.id}
                    className={`album-item ${
                      activeFilter.albumId === album.id ? "active" : ""
                    }`}
                  >
                    <button
                      className="album-select"
                      onClick={() =>
                        setActiveFilter((prev) => ({ ...prev, albumId: album.id }))
                      }
                      title={album.name}
                      type="button"
                    >
                      {label}
                    </button>
                    {!sidebarCollapsed && (
                      <button
                        className="album-delete"
                        onClick={() => deleteAlbum(album.id)}
                        aria-label={`Delete ${album.name}`}
                        type="button"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {!sidebarCollapsed && (
              <div className="album-create">
                <input
                  type="text"
                  placeholder="New album"
                  value={newAlbumName}
                  onChange={(event) => setNewAlbumName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void createAlbum();
                    }
                  }}
                />
                <button className="album-create-button" onClick={createAlbum} type="button">
                  Add
                </button>
              </div>
            )}
          </div>
        </aside>
        <main className="content">
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
                      {filteredTagSuggestions.length > 0 && (
                        <div className="filter-suggestions">
                          {filteredTagSuggestions.map((tag) => (
                            <button
                              key={`suggest-${tag.key}`}
                              className="filter-suggestion"
                              onClick={() => addFilterTag(tag.label)}
                              type="button"
                            >
                              {tag.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {tagSuggestionsStatus === "loading" && (
                        <div className="filter-hint">Loading tags...</div>
                      )}
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
                      setActiveFilter((prev) => ({ ...prev, from: "", to: "", tags: "" }));
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
                      setActiveFilter((prev) => ({
                        ...prev,
                        from: filterDraft.from,
                        to: filterDraft.to,
                        tags: filterDraft.tags.join(", "),
                      }));
                      setFilterOpen(false);
                    }}
                  >
                    Filter
                  </button>
                </div>
              </div>
            </div>
          )}
          {albumPickerOpen && (
            <div className="album-dialog" role="dialog" aria-modal="true">
              <button
                className="album-backdrop"
                onClick={() => setAlbumPickerOpen(false)}
                aria-label="Close albums"
              />
              <div className="album-panel">
                <div className="album-header">
                  <div className="album-title">Add to album</div>
                  <button className="album-close" onClick={() => setAlbumPickerOpen(false)}>
                    Close
                  </button>
                </div>
                <div className="album-dialog-create">
                  <input
                    type="text"
                    placeholder="New album"
                    value={newAlbumName}
                    onChange={(event) => setNewAlbumName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void createAlbum();
                      }
                    }}
                  />
                  <button
                    className="album-dialog-create-button"
                    onClick={createAlbum}
                    type="button"
                  >
                    Create
                  </button>
                </div>
                <div className="album-dialog-list">
                  {albums.length === 0 && (
                    <div className="album-empty">Create an album first.</div>
                  )}
                  {albums.map((album) => (
                    <button
                      key={`add-${album.id}`}
                      className="album-dialog-item"
                      onClick={() => {
                        void addSelectionToAlbum(album.id);
                        setAlbumPickerOpen(false);
                      }}
                      type="button"
                    >
                      <span>{album.name}</span>
                      <span className="album-dialog-action">Add</span>
                    </button>
                  ))}
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
            onToggleFavorites={toggleFavoritesSelected}
            selectionFavoriteActive={selectionFavoriteActive}
            selectionFavoriteLabel={selectionFavoriteLabel}
            onAddToAlbum={() => setAlbumPickerOpen(true)}
            showRemoveFromAlbum={Boolean(activeFilter.albumId)}
            removeAlbumLabel="Remove from album"
            onRemoveFromAlbum={removeSelectionFromAlbum}
            importingItems={importingItems}
            isImporting={isImporting}
            dateGroups={dateGroups}
            indexById={indexById}
            toggleSelect={toggleSelect}
          />
        </main>
      </div>

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
          isFavorite={Boolean((detailItem || currentItem).favorite)}
          onToggleFavorite={() => {
            const target = detailItem || currentItem;
            if (!target) return;
            void updateFavorite(target.id, !target.favorite);
          }}
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

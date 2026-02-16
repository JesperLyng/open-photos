import { memo } from "react";
import type {
  Dispatch,
  MouseEvent,
  RefObject,
  SetStateAction,
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  CSSProperties,
} from "react";
import type { DateGroup, LibraryItem } from "../types/media";

type LibraryState = {
  status: string;
  items: LibraryItem[];
  error?: string;
};

type LibraryGridProps = {
  gridRef: RefObject<HTMLElement>;
  authStatus: string;
  library: LibraryState;
  selection: Set<string>;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  selectedTags: { common: string[]; mixed: string[] };
  bulkTagDraft: string;
  setBulkTagDraft: Dispatch<SetStateAction<string>>;
  onBulkTagAdd: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onBulkTagRemove: (tag: string) => void;
  onBulkTagApply: (tag: string) => void;
  onToggleFavorites: () => void;
  selectionFavoriteActive: boolean;
  selectionFavoriteLabel: string;
  onAddToAlbum: () => void;
  showRemoveFromAlbum: boolean;
  removeAlbumLabel: string;
  onRemoveFromAlbum: () => void;
  importingItems: LibraryItem[];
  isImporting: boolean;
  dateGroups: DateGroup[];
  isDragging: boolean;
  setIsDragging: Dispatch<SetStateAction<boolean>>;
  handleUploadFiles: (files: File[]) => void;
  indexById: Map<string, number>;
  toggleSelect: (index: number, event: MouseEvent) => void;
};

export const LibraryGrid = memo(function LibraryGrid({
  gridRef,
  authStatus,
  library,
  selection,
  onDeleteSelected,
  onClearSelection,
  selectedTags,
  bulkTagDraft,
  setBulkTagDraft,
  onBulkTagAdd,
  onBulkTagRemove,
  onBulkTagApply,
  onToggleFavorites,
  selectionFavoriteActive,
  selectionFavoriteLabel,
  onAddToAlbum,
  showRemoveFromAlbum,
  removeAlbumLabel,
  onRemoveFromAlbum,
  importingItems,
  isImporting,
  dateGroups,
  isDragging,
  setIsDragging,
  handleUploadFiles,
  indexById,
  toggleSelect,
}: LibraryGridProps) {
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
      {authStatus !== "authenticated" && <p>Sign in to upload files.</p>}
      {authStatus === "loading" && <p>Checking session...</p>}
      {authStatus === "anonymous" && library.status === "idle" && (
        <p>Sign in to view your library.</p>
      )}
      {authStatus === "authenticated" && library.status === "loading" && (
        <p>Loading library...</p>
      )}
      {library.status === "error" && <p className="error">{library.error}</p>}
      {selection.size > 0 && (
        <div className="selection-bar" onClick={(event) => event.stopPropagation()}>
          <div className="selection-info">
            <div>{selection.size} selected</div>
            <div className="selection-tags">
              <input
                className="tag-input"
                value={bulkTagDraft}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setBulkTagDraft(event.target.value)
                }
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
                  <button
                    key={`mixed-${tag}`}
                    type="button"
                    className="tag-pill muted tag-pill-action"
                    onClick={() => onBulkTagApply(tag)}
                    aria-label={`Apply ${tag} to all selected photos`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="selection-actions">
            <button
              className={`icon-button favorite-button ${
                selectionFavoriteActive ? "active" : ""
              }`}
              onClick={onToggleFavorites}
              title={selectionFavoriteLabel}
              aria-label={selectionFavoriteLabel}
              aria-pressed={selectionFavoriteActive}
              type="button"
            >
              <svg className="heart-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 20.5l-1.4-1.3C6.2 15.3 3 12.4 3 8.9 3 6.6 4.8 5 7 5c1.5 0 3 .7 4 1.9C12 5.7 13.5 5 15 5c2.2 0 4 1.6 4 3.9 0 3.5-3.2 6.4-7.6 10.3L12 20.5z"
                  fill="currentColor"
                />
                </svg>
            </button>
            <button className="button ghost light" onClick={onAddToAlbum}>
              Add to album
            </button>
            {showRemoveFromAlbum && (
              <button className="button ghost light" onClick={onRemoveFromAlbum}>
                {removeAlbumLabel}
              </button>
            )}
            <button className="button ghost light" onClick={onClearSelection}>
              Clear
            </button>
            <button className="button ghost light" onClick={onDeleteSelected}>
              Delete
            </button>
          </div>
        </div>
      )}
      {library.status === "ok" && library.items.length === 0 && <p>No assets yet.</p>}
      {isImporting && (
        <div className="year-groups">
          <div className="year-group">
            <div className="year-header">Importing</div>
            <div className="importing-grid">
              {importingItems.length > 0
                ? importingItems.map((item) => (
                    <div key={item.id} className="importing-tile">
                      <div className="photo-img placeholder" />
                      <div className="importing-label">{item.filename || "Processing..."}</div>
                    </div>
                  ))
                : <div className="importing-empty">Waiting for processing...</div>
              }
            </div>
          </div>
        </div>
      )}
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
                    <div
                      key={`${group.key}-${rowIndex}`}
                      className="photo-row"
                      style={
                        {
                          "--row-height": `${Math.max(155, Math.round(row.height))}px`,
                        } as CSSProperties
                      }
                    >
                      {row.tiles.map((tile) => {
                        const globalIndex = indexById.get(tile.item.id);
                        if (globalIndex === undefined) return null;
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
                                loading="lazy"
                                decoding="async"
                                fetchPriority="low"
                              />
                            ) : (
                              <div className="photo-img placeholder" />
                            )}
                            {tile.item.favorite && (
                              <span className="photo-favorite" aria-label="Favorite">
                                <svg className="heart-icon" viewBox="0 0 24 24" aria-hidden="true">
                                  <path
                                    d="M12 20.5l-1.4-1.3C6.2 15.3 3 12.4 3 8.9 3 6.6 4.8 5 7 5c1.5 0 3 .7 4 1.9C12 5.7 13.5 5 15 5c2.2 0 4 1.6 4 3.9 0 3.5-3.2 6.4-7.6 10.3L12 20.5z"
                                    fill="currentColor"
                                  />
                                </svg>
                              </span>
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

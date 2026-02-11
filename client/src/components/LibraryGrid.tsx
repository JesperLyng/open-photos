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
import { getOrientationTransform } from "../lib/layout";

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
                                loading="lazy"
                                decoding="async"
                                fetchPriority="low"
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

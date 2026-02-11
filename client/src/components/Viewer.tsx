import type {
  CSSProperties,
  Dispatch,
  RefObject,
  SetStateAction,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { displayText, formatAperture, formatDate, formatExposure, formatFocalLength, formatIso, readExif } from "../lib/exif";
import { getOrientationTransform } from "../lib/layout";
import type { LibraryItem } from "../types/media";

type ViewerProps = {
  viewerRef: RefObject<HTMLDivElement>;
  currentItem: LibraryItem;
  detailItem: LibraryItem | null;
  viewerIndex: number;
  totalCount: number;
  isFullscreen: boolean;
  onClose: () => void;
  onToggleFullscreen: () => void;
  onPrev: () => void;
  onNext: () => void;
  tagDraft: string;
  setTagDraft: Dispatch<SetStateAction<string>>;
  onTagAdd: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  onTagRemove: (tag: string) => void;
};

export function Viewer({
  viewerRef,
  currentItem,
  detailItem,
  viewerIndex,
  totalCount,
  isFullscreen,
  onClose,
  onToggleFullscreen,
  onPrev,
  onNext,
  tagDraft,
  setTagDraft,
  onTagAdd,
  onTagRemove,
}: ViewerProps) {
  const transform = getOrientationTransform(detailItem?.metadata?.orientation);
  const imgStyle = transform ? ({ "--img-transform": transform } as CSSProperties) : undefined;

  return (
    <div className="viewer" role="dialog" aria-modal="true" ref={viewerRef}>
      <button className="viewer-backdrop" onClick={onClose} />
      <div className={`viewer-content ${isFullscreen ? "fullscreen" : ""}`}>
        <div className="viewer-topbar">
          {!isFullscreen && (
            <div className="viewer-tags">
              <input
                className="tag-input"
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={onTagAdd}
                placeholder="Add tag"
              />
              <div className="tag-list">
                {(detailItem?.tags || []).map((tag) => (
                  <span key={tag} className="tag-pill">
                    {tag}
                    <button
                      className="tag-remove"
                      onClick={() => onTagRemove(tag)}
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
              <button className="viewer-close" onClick={onClose}>
                Close
              </button>
            )}
            <button className="viewer-fullscreen" onClick={onToggleFullscreen}>
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </button>
          </div>
        </div>
        <div className={`viewer-body ${isFullscreen ? "fullscreen" : ""}`}>
          {currentItem.thumbUrl ? (
            <img
              className="viewer-image"
              src={currentItem.originalUrl || currentItem.thumbUrl}
              alt={currentItem.filename || "asset"}
              style={imgStyle}
            />
          ) : (
            <div className="viewer-image placeholder" />
          )}
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
              onClick={onPrev}
              disabled={viewerIndex === 0}
            >
              Previous
            </button>
            <button
              className="button"
              onClick={onNext}
              disabled={viewerIndex === totalCount - 1}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

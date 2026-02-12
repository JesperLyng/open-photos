import { useEffect, useLayoutEffect, useState } from "react";
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
  isFavorite: boolean;
  onToggleFavorite: () => void;
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
  isFavorite,
  onToggleFavorite,
}: ViewerProps) {
  const imageItem = detailItem || currentItem;
  const thumbSrc = imageItem?.thumbUrl || null;
  const previewSrc = imageItem?.previewUrl || null;
  const originalSrc = imageItem?.originalUrl || null;
  const fallbackSrc = thumbSrc || previewSrc || originalSrc;
  const targetSrc = isFullscreen
    ? originalSrc || previewSrc
    : previewSrc || originalSrc;
  const [displaySrc, setDisplaySrc] = useState<string | null>(fallbackSrc);

  const rankSrc = (src: string | null) => {
    if (!src) return 0;
    if (src === originalSrc) return 3;
    if (src === previewSrc) return 2;
    if (src === thumbSrc) return 1;
    return 0;
  };

  useEffect(() => {
    setDisplaySrc(fallbackSrc);
  }, [imageItem?.id, fallbackSrc]);

  useLayoutEffect(() => {
    if (!targetSrc) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setDisplaySrc((prev) =>
        rankSrc(targetSrc) >= rankSrc(prev) ? targetSrc : prev,
      );
    };
    img.src = targetSrc;
    if (img.complete) {
      setDisplaySrc((prev) =>
        rankSrc(targetSrc) >= rankSrc(prev) ? targetSrc : prev,
      );
    }
    return () => {
      cancelled = true;
    };
  }, [targetSrc, thumbSrc, previewSrc, originalSrc]);
  const orientation = imageItem?.metadata?.orientation;
  const transform = getOrientationTransform(orientation);

  const derivedWidth = imageItem?.derived?.small?.width;
  const derivedHeight = imageItem?.derived?.small?.height;
  const metaWidth = imageItem?.metadata?.width;
  const metaHeight = imageItem?.metadata?.height;

  let displayWidth = derivedWidth ?? metaWidth;
  let displayHeight = derivedHeight ?? metaHeight;
  if (
    !derivedWidth &&
    displayWidth &&
    displayHeight &&
    orientation &&
    [5, 6, 7, 8].includes(orientation)
  ) {
    [displayWidth, displayHeight] = [displayHeight, displayWidth];
  }

  const aspectRatio =
    displayWidth && displayHeight ? displayWidth / displayHeight : undefined;
  const isPortrait =
    displayWidth && displayHeight ? displayHeight > displayWidth : false;

  const frameStyle: CSSProperties = {
    ...(transform ? ({ "--img-transform": transform } as CSSProperties) : {}),
    ...(!isFullscreen && aspectRatio ? { aspectRatio } : {}),
  };

  return (
    <div className="viewer" role="dialog" aria-modal="true" ref={viewerRef}>
      <button className="viewer-backdrop" onClick={onClose} />
      <div className={`viewer-content ${isFullscreen ? "fullscreen" : ""}`}>
        {!isFullscreen && (
          <div className="viewer-topbar">
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
            <div className="viewer-actions-inline">
              <button className="viewer-close" onClick={onClose}>
                Close
              </button>
              <button
                className={`viewer-favorite ${isFavorite ? "active" : ""}`}
                onClick={onToggleFavorite}
                aria-label={isFavorite ? "Remove favorite" : "Mark as favorite"}
                aria-pressed={isFavorite}
                type="button"
              >
                <svg className="heart-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 20.5l-1.4-1.3C6.2 15.3 3 12.4 3 8.9 3 6.6 4.8 5 7 5c1.5 0 3 .7 4 1.9C12 5.7 13.5 5 15 5c2.2 0 4 1.6 4 3.9 0 3.5-3.2 6.4-7.6 10.3L12 20.5z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
        <div className={`viewer-body ${isFullscreen ? "fullscreen" : ""}`}>
          <div
            className={`viewer-image-frame clickable ${isFullscreen ? "fullscreen" : ""} ${
              isPortrait ? "portrait" : ""
            }`}
            style={frameStyle}
            onClick={onToggleFullscreen}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggleFullscreen();
              }
            }}
          >
            {displaySrc ? (
              <img
                className="viewer-image"
                src={displaySrc}
                alt={imageItem?.filename || "asset"}
              />
            ) : (
              <div className="viewer-image placeholder" />
            )}
          </div>
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

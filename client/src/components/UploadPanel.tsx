import type { Dispatch, SetStateAction } from "react";
import type { UploadItem } from "../types/media";

type UploadPanelProps = {
  uploads: UploadItem[];
  uploadPanelOpen: boolean;
  setUploadPanelOpen: Dispatch<SetStateAction<boolean>>;
  onClearDone: () => void;
  onCancelUpload: (id: string) => void;
  onCancelAll: () => void;
};

export function UploadPanel({
  uploads,
  uploadPanelOpen,
  setUploadPanelOpen,
  onClearDone,
  onCancelUpload,
  onCancelAll,
}: UploadPanelProps) {
  const counts = uploads.reduce(
    (acc, item) => {
      if (item.status === "done" || item.status === "duplicate" || item.status === "cancelled") {
        acc.completed += 1;
      }
      else if (item.status === "error") acc.failed += 1;
      else acc.active += 1;
      return acc;
    },
    { active: 0, completed: 0, failed: 0 },
  );

  return (
    <aside className={`upload-panel ${uploadPanelOpen ? "" : "collapsed"}`}>
      <div className="upload-header">
        <div className="upload-header-main">
          <div className="upload-title">Uploads</div>
          <div className="upload-actions">
            {counts.active > 0 && (
              <button className="upload-link upload-cancel" onClick={onCancelAll} type="button">
                Cancel all
              </button>
            )}
            <button className="upload-link" onClick={onClearDone}>
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
        {(counts.active > 0 || counts.completed > 0 || counts.failed > 0) && (
          <div className="upload-count">
            {counts.active} active · {counts.completed} done
            {counts.failed > 0 ? ` · ${counts.failed} failed` : ""}
          </div>
        )}
      </div>
      {uploadPanelOpen && (
        <div className="upload-body">
          {uploads.map((item) => (
            <div key={item.id} className="upload-item">
              <span className={`upload-dot ${item.status}`} />
              <div className="upload-meta">
                <div className="upload-topline">
                  <div className="upload-name">{item.name}</div>
                  {["queued", "hashing", "init", "ready", "uploading", "finalizing"].includes(
                    item.status,
                  ) && (
                    <button
                      className="upload-link upload-cancel"
                      onClick={() => onCancelUpload(item.id)}
                      type="button"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <div className="upload-status">
                  {item.status === "queued" && "Queued"}
                  {item.status === "hashing" && "Hashing"}
                  {item.status === "init" && "Preparing"}
                  {item.status === "ready" && "Ready"}
                  {item.status === "uploading" &&
                    `Uploading${item.progress ? ` ${item.progress}%` : ""}`}
                  {item.status === "finalizing" && "Finalizing"}
                  {item.status === "cancelled" && "Cancelled"}
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
  );
}

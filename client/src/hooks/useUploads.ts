import { useCallback, useState } from "react";
import type { ChangeEvent } from "react";
import { uploadWithProgress } from "../lib/upload";
import type { UploadItem, UploadStatus } from "../types/media";
import { apiOrigin } from "../lib/api";
import type { AuthState } from "./useAuth";

type UseUploadsParams = {
  auth: AuthState;
  refreshLibrary: () => Promise<void>;
};

export function useUploads({ auth, refreshLibrary }: UseUploadsParams) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadPanelOpen, setUploadPanelOpen] = useState(true);

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

          const initRes = await fetch(`${apiOrigin}/api/uploads/init`, {
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
          const completeRes = await fetch(`${apiOrigin}/api/uploads/complete`, {
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

        await refreshLibrary();
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
    [auth, addUploads, computeSHA256, refreshLibrary, updateUpload],
  );

  const handleUploadInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      event.target.value = "";
      void handleUploadFiles(files);
    },
    [handleUploadFiles],
  );

  return {
    uploads,
    setUploads,
    uploadPanelOpen,
    setUploadPanelOpen,
    handleUploadFiles,
    handleUploadInput,
  };
}

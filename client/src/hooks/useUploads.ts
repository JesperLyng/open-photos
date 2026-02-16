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
      const token = auth.user?.access_token;
      const uploadConcurrency = 4;

      // Prepared items ready for upload, plus a way to wait for more
      type PreparedTask = {
        id: string;
        file: File;
        uploadUrl: string;
        contentType: string;
        key: string;
        bucket: string;
        size: number;
        filename: string;
        checksum: string;
      };
      const ready: PreparedTask[] = [];
      let prepDone = false;
      const waiters: (() => void)[] = [];

      function waitForReady(): Promise<void> {
        if (ready.length > 0 || prepDone) return Promise.resolve();
        return new Promise((resolve) => { waiters.push(resolve); });
      }

      function wakeWaiters() {
        while (waiters.length > 0) waiters.shift()!();
      }

      // --- Prepare worker: hash + init, feeds the ready queue ---
      const prepareAll = async () => {
        for (const task of tasks) {
          try {
            updateUpload(task.id, { status: "hashing" });
            const checksum = await computeSHA256(task.file);
            updateUpload(task.id, { status: "init" });

            const initRes = await fetch(`${apiOrigin}/api/uploads/init`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                filename: task.file.name,
                contentType: task.file.type || "application/octet-stream",
                size: task.file.size,
                checksum,
              }),
            });

            if (!initRes.ok) {
              updateUpload(task.id, { status: "error", error: `Init failed (${initRes.status})` });
              continue;
            }

            const initData = await initRes.json();
            if (initData.duplicate) {
              updateUpload(task.id, { status: "duplicate", progress: 100 });
              continue;
            }

            updateUpload(task.id, { status: "ready" });
            ready.push({
              id: task.id,
              file: task.file,
              uploadUrl: initData.uploadUrl,
              contentType: initData.contentType,
              key: initData.key,
              bucket: initData.bucket,
              size: initData.size,
              filename: initData.filename,
              checksum,
            });
            wakeWaiters();
          } catch (error) {
            updateUpload(task.id, { status: "error", error: (error as Error).message });
          }
        }
        prepDone = true;
        wakeWaiters();
      };

      // --- Upload worker: takes prepared items and uploads to S3 ---
      const uploadWorker = async () => {
        while (true) {
          await waitForReady();
          const item = ready.shift();
          if (!item) {
            if (prepDone) return;
            continue;
          }

          try {
            updateUpload(item.id, { status: "uploading", progress: 0 });
            await uploadWithProgress(
              item.uploadUrl,
              item.contentType,
              item.file,
              (progress) => updateUpload(item.id, { progress }),
            );

            updateUpload(item.id, { status: "finalizing" });
            const completeRes = await fetch(`${apiOrigin}/api/uploads/complete`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                key: item.key,
                bucket: item.bucket,
                contentType: item.contentType,
                size: item.size,
                filename: item.filename,
                checksum: item.checksum,
              }),
            });

            if (!completeRes.ok) {
              updateUpload(item.id, { status: "error", error: `Complete failed (${completeRes.status})` });
              continue;
            }

            updateUpload(item.id, { status: "done", progress: 100 });
            refreshLibrary();
          } catch (error) {
            updateUpload(item.id, { status: "error", error: (error as Error).message });
          }
        }
      };

      // Run prepare worker + upload workers in parallel
      await Promise.all([
        prepareAll(),
        ...Array.from({ length: uploadConcurrency }, () => uploadWorker()),
      ]);
      await refreshLibrary();
      // Server-side processing may still be running; poll until all items are ready
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        await refreshLibrary();
      }
    },
    [auth, addUploads, computeSHA256, updateUpload, refreshLibrary],
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

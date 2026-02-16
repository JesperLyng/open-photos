import { useCallback, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { uploadWithProgress } from "../lib/upload";
import type { UploadItem, UploadStatus } from "../types/media";
import { apiOrigin } from "../lib/api";
import type { AuthState } from "./useAuth";

type UseUploadsParams = {
  auth: AuthState;
  refreshLibrary: () => Promise<void>;
};

const ACTIVE_UPLOAD_STATUSES: UploadStatus[] = [
  "queued",
  "hashing",
  "init",
  "ready",
  "uploading",
  "finalizing",
];

function isActiveUploadStatus(status: UploadStatus) {
  return ACTIVE_UPLOAD_STATUSES.includes(status);
}

export function useUploads({ auth, refreshLibrary }: UseUploadsParams) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploadPanelOpen, setUploadPanelOpen] = useState(true);
  const cancelledIdsRef = useRef<Set<string>>(new Set());
  const activeXhrRef = useRef<Map<string, XMLHttpRequest>>(new Map());

  const computeSHA256 = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }, []);

  const addUploads = useCallback((files: File[]) => {
    const tasks = files.map((file) => ({ id: crypto.randomUUID(), file }));
    for (const task of tasks) {
      cancelledIdsRef.current.delete(task.id);
      activeXhrRef.current.delete(task.id);
    }

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

  const handleCancelUpload = useCallback(
    (id: string) => {
      cancelledIdsRef.current.add(id);
      const xhr = activeXhrRef.current.get(id);
      if (xhr) {
        xhr.abort();
        activeXhrRef.current.delete(id);
      }
      updateUpload(id, {
        status: "cancelled",
        error: undefined,
      });
    },
    [updateUpload],
  );

  const handleCancelAll = useCallback(() => {
    for (const [id, xhr] of activeXhrRef.current) {
      cancelledIdsRef.current.add(id);
      xhr.abort();
    }
    activeXhrRef.current.clear();

    setUploads((prev) =>
      prev.map((item) => {
        if (!isActiveUploadStatus(item.status)) {
          return item;
        }
        cancelledIdsRef.current.add(item.id);
        return {
          ...item,
          status: "cancelled",
          error: undefined,
        };
      }),
    );
  }, []);

  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || auth.status !== "authenticated") return;
      const tasks = addUploads(files);
      const token = auth.user?.access_token;
      const uploadConcurrency = 4;

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
      const waiters: Array<() => void> = [];
      const isCancelled = (id: string) => cancelledIdsRef.current.has(id);

      function waitForReady(): Promise<void> {
        if (ready.length > 0 || prepDone) return Promise.resolve();
        return new Promise((resolve) => {
          waiters.push(resolve);
        });
      }

      function wakeWaiters() {
        const current = waiters.splice(0, waiters.length);
        for (const resolve of current) {
          resolve();
        }
      }

      const prepareAll = async () => {
        for (const task of tasks) {
          if (isCancelled(task.id)) {
            updateUpload(task.id, { status: "cancelled", error: undefined });
            continue;
          }

          try {
            updateUpload(task.id, { status: "hashing" });
            const checksum = await computeSHA256(task.file);
            if (isCancelled(task.id)) {
              updateUpload(task.id, { status: "cancelled", error: undefined });
              continue;
            }

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
              updateUpload(task.id, {
                status: "error",
                error: `Init failed (${initRes.status})`,
              });
              continue;
            }

            const initData = await initRes.json();
            if (isCancelled(task.id)) {
              updateUpload(task.id, { status: "cancelled", error: undefined });
              continue;
            }

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
            if (isCancelled(task.id)) {
              updateUpload(task.id, { status: "cancelled", error: undefined });
            } else {
              updateUpload(task.id, { status: "error", error: (error as Error).message });
            }
          }
        }

        prepDone = true;
        wakeWaiters();
      };

      const uploadWorker = async () => {
        while (true) {
          await waitForReady();
          const item = ready.shift();
          if (!item) {
            if (prepDone) return;
            continue;
          }

          if (isCancelled(item.id)) {
            updateUpload(item.id, { status: "cancelled", error: undefined });
            continue;
          }

          try {
            updateUpload(item.id, { status: "uploading", progress: 0 });
            await uploadWithProgress(
              item.uploadUrl,
              item.contentType,
              item.file,
              (progress) => updateUpload(item.id, { progress }),
              (xhr) => {
                activeXhrRef.current.set(item.id, xhr);
              },
            );
            activeXhrRef.current.delete(item.id);

            if (isCancelled(item.id)) {
              updateUpload(item.id, { status: "cancelled", error: undefined });
              continue;
            }

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
              updateUpload(item.id, {
                status: "error",
                error: `Complete failed (${completeRes.status})`,
              });
              continue;
            }

            const completeData = await completeRes.json();

            if (isCancelled(item.id)) {
              updateUpload(item.id, { status: "cancelled", error: undefined });
              continue;
            }

            updateUpload(item.id, { status: "done", progress: 100, assetId: completeData.id });
            void refreshLibrary();
          } catch (error) {
            activeXhrRef.current.delete(item.id);
            if (isCancelled(item.id)) {
              updateUpload(item.id, { status: "cancelled", error: undefined });
            } else {
              updateUpload(item.id, { status: "error", error: (error as Error).message });
            }
          }
        }
      };

      await Promise.all([
        prepareAll(),
        ...Array.from({ length: uploadConcurrency }, () => uploadWorker()),
      ]);
      await refreshLibrary();
      for (let i = 0; i < 10; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        await refreshLibrary();
      }
    },
    [auth, addUploads, computeSHA256, refreshLibrary, updateUpload],
  );

  const markAssetFailed = useCallback((assetId: string) => {
    setUploads((prev) =>
      prev.map((item) =>
        item.assetId === assetId
          ? { ...item, status: "error" as UploadStatus, error: "Failed" }
          : item,
      ),
    );
  }, []);

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
    handleCancelUpload,
    handleCancelAll,
    markAssetFailed,
  };
}

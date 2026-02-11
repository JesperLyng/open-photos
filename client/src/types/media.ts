export type LibraryItem = {
  id: string;
  status: string;
  filename?: string;
  original?: { key?: string };
  derived?: { small?: { width?: number; height?: number } };
  thumbUrl?: string | null;
  previewUrl?: string | null;
  originalUrl?: string | null;
  createdAt?: string;
  tags?: string[];
  metadata?: {
    capturedAt?: string;
    width?: number;
    height?: number;
    orientation?: number;
    exif?: Record<string, unknown>;
  };
};

export type UploadStatus =
  | "queued"
  | "hashing"
  | "init"
  | "uploading"
  | "finalizing"
  | "done"
  | "duplicate"
  | "error";

export type UploadItem = {
  id: string;
  name: string;
  status: UploadStatus;
  error?: string;
  progress?: number;
};

export type LayoutTile = {
  item: LibraryItem;
  width: number;
  height: number;
};

export type LayoutRow = {
  height: number;
  tiles: LayoutTile[];
};

export type DateGroup = {
  key: string;
  label: string;
  items: LibraryItem[];
  rows: LayoutRow[];
};

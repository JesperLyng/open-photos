import { describe, it, expect, vi } from "vitest";

// Mock file-type before importing the module under test
vi.mock("file-type", () => ({
  fileTypeFromBuffer: vi.fn(),
}));

// Mock security to avoid config/dotenv side effects
vi.mock("../../lib/security.js", () => ({
  ALLOWED_MIME_TYPES: new Set([
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
    "image/webp",
    "video/mp4",
    "video/quicktime",
  ]),
}));

import { validateFileType } from "../../lib/file-validation.js";
import { fileTypeFromBuffer } from "file-type";

const mockFileType = vi.mocked(fileTypeFromBuffer);

describe("validateFileType", () => {
  it("passes for valid JPEG buffer", async () => {
    mockFileType.mockResolvedValue({ ext: "jpg", mime: "image/jpeg" });
    await expect(validateFileType(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg")).resolves.toBeUndefined();
  });

  it("passes for valid PNG buffer", async () => {
    mockFileType.mockResolvedValue({ ext: "png", mime: "image/png" });
    await expect(validateFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47]), "image/png")).resolves.toBeUndefined();
  });

  it("fails when file type cannot be detected", async () => {
    mockFileType.mockResolvedValue(undefined);
    await expect(validateFileType(Buffer.from("hello world"))).rejects.toThrow("Unable to detect file type");
  });

  it("includes declared type in error when detection fails", async () => {
    mockFileType.mockResolvedValue(undefined);
    await expect(validateFileType(Buffer.from("hello"), "image/jpeg")).rejects.toThrow("declared: image/jpeg");
  });

  it("fails when detected type is not in allowlist", async () => {
    mockFileType.mockResolvedValue({ ext: "pdf", mime: "application/pdf" });
    await expect(validateFileType(Buffer.from([0x25, 0x50, 0x44]))).rejects.toThrow("not allowed");
  });

  it("fails when declared type mismatches detected type", async () => {
    mockFileType.mockResolvedValue({ ext: "png", mime: "image/png" });
    await expect(validateFileType(Buffer.from([0x89, 0x50]), "image/jpeg")).rejects.toThrow(
      "does not match detected type",
    );
  });

  it("allows HEIC/HEIF mismatch", async () => {
    mockFileType.mockResolvedValue({ ext: "heic", mime: "image/heic" });
    await expect(validateFileType(Buffer.from([0x00]), "image/heif")).resolves.toBeUndefined();
  });

  it("allows HEIF declared when HEIC detected", async () => {
    mockFileType.mockResolvedValue({ ext: "heif", mime: "image/heif" });
    await expect(validateFileType(Buffer.from([0x00]), "image/heic")).resolves.toBeUndefined();
  });

  it("passes when no declared type is provided", async () => {
    mockFileType.mockResolvedValue({ ext: "jpg", mime: "image/jpeg" });
    await expect(validateFileType(Buffer.from([0xff, 0xd8]))).resolves.toBeUndefined();
  });

  it("fails for empty buffer when type is undetectable", async () => {
    mockFileType.mockResolvedValue(undefined);
    await expect(validateFileType(Buffer.alloc(0))).rejects.toThrow("Unable to detect file type");
  });
});

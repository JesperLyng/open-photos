import { describe, it, expect } from "vitest";
import { uploadInitSchema, uploadCompleteSchema } from "../../schemas/uploads.js";

describe("uploadInitSchema", () => {
  const schema = uploadInitSchema.body;

  it("accepts a valid payload", () => {
    const result = schema.safeParse({
      filename: "photo.jpg",
      contentType: "image/jpeg",
      size: 1024,
      checksum: "abc123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload without optional fields", () => {
    const result = schema.safeParse({
      filename: "photo.jpg",
      contentType: "image/jpeg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing filename", () => {
    const result = schema.safeParse({
      contentType: "image/jpeg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing contentType", () => {
    const result = schema.safeParse({
      filename: "photo.jpg",
    });
    expect(result.success).toBe(false);
  });

  it("rejects contentType that is not image/* or video/*", () => {
    const result = schema.safeParse({
      filename: "doc.pdf",
      contentType: "application/pdf",
    });
    expect(result.success).toBe(false);
  });

  it("accepts video/* contentType", () => {
    const result = schema.safeParse({
      filename: "clip.mp4",
      contentType: "video/mp4",
    });
    expect(result.success).toBe(true);
  });

  it("rejects size exceeding 500MB", () => {
    const result = schema.safeParse({
      filename: "big.jpg",
      contentType: "image/jpeg",
      size: 500 * 1024 * 1024 + 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts size exactly 500MB", () => {
    const result = schema.safeParse({
      filename: "big.jpg",
      contentType: "image/jpeg",
      size: 500 * 1024 * 1024,
    });
    expect(result.success).toBe(true);
  });

  it("rejects size of zero", () => {
    const result = schema.safeParse({
      filename: "empty.jpg",
      contentType: "image/jpeg",
      size: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer size", () => {
    const result = schema.safeParse({
      filename: "photo.jpg",
      contentType: "image/jpeg",
      size: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty filename", () => {
    const result = schema.safeParse({
      filename: "",
      contentType: "image/jpeg",
    });
    expect(result.success).toBe(false);
  });
});

describe("uploadCompleteSchema", () => {
  const schema = uploadCompleteSchema.body;

  it("accepts a valid payload", () => {
    const result = schema.safeParse({
      key: "uploads/abc123",
      bucket: "my-bucket",
      contentType: "image/jpeg",
      size: 2048,
      filename: "photo.jpg",
      checksum: "sha256-abc",
    });
    expect(result.success).toBe(true);
  });

  it("accepts payload with only required fields", () => {
    const result = schema.safeParse({
      key: "uploads/abc123",
      bucket: "my-bucket",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing key", () => {
    const result = schema.safeParse({
      bucket: "my-bucket",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing bucket", () => {
    const result = schema.safeParse({
      key: "uploads/abc123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty key", () => {
    const result = schema.safeParse({
      key: "",
      bucket: "my-bucket",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty bucket", () => {
    const result = schema.safeParse({
      key: "uploads/abc123",
      bucket: "",
    });
    expect(result.success).toBe(false);
  });
});

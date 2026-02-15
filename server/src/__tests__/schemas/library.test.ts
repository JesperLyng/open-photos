import { describe, it, expect } from "vitest";
import { libraryQuerySchema } from "../../schemas/library.js";

describe("libraryQuerySchema", () => {
  const schema = libraryQuerySchema.querystring;

  it("applies defaults when no fields provided", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("coerces string limit to number", () => {
    const result = schema.safeParse({ limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects limit of 0", () => {
    const result = schema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects limit exceeding 200", () => {
    const result = schema.safeParse({ limit: 201 });
    expect(result.success).toBe(false);
  });

  it("accepts limit of 200", () => {
    const result = schema.safeParse({ limit: 200 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(200);
    }
  });

  it("accepts limit of 1", () => {
    const result = schema.safeParse({ limit: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts valid ISO datetime for from/to", () => {
    const result = schema.safeParse({
      from: "2024-01-01T00:00:00+00:00",
      to: "2024-12-31T23:59:59+00:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid datetime for from", () => {
    const result = schema.safeParse({ from: "not-a-date" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid datetime for to", () => {
    const result = schema.safeParse({ to: "2024-13-01" });
    expect(result.success).toBe(false);
  });

  it("accepts favorite=true", () => {
    const result = schema.safeParse({ favorite: "true" });
    expect(result.success).toBe(true);
  });

  it("accepts favorite=false", () => {
    const result = schema.safeParse({ favorite: "false" });
    expect(result.success).toBe(true);
  });

  it("rejects favorite with invalid value", () => {
    const result = schema.safeParse({ favorite: "yes" });
    expect(result.success).toBe(false);
  });

  it("accepts optional cursor", () => {
    const result = schema.safeParse({ cursor: "abc123" });
    expect(result.success).toBe(true);
  });

  it("accepts optional tags", () => {
    const result = schema.safeParse({ tags: "sunset,beach" });
    expect(result.success).toBe(true);
  });

  it("accepts optional albumId", () => {
    const result = schema.safeParse({ albumId: "507f1f77bcf86cd799439011" });
    expect(result.success).toBe(true);
  });
});

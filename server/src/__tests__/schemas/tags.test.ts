import { describe, it, expect } from "vitest";
import { tagsQuerySchema } from "../../schemas/tags.js";

describe("tagsQuerySchema", () => {
  const schema = tagsQuerySchema.querystring;

  it("applies defaults when no fields provided", () => {
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("");
      expect(result.data.limit).toBe(200);
    }
  });

  it("coerces string limit to number", () => {
    const result = schema.safeParse({ limit: "100" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(100);
    }
  });

  it("rejects limit of 0", () => {
    const result = schema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects limit exceeding 500", () => {
    const result = schema.safeParse({ limit: 501 });
    expect(result.success).toBe(false);
  });

  it("accepts limit of 500", () => {
    const result = schema.safeParse({ limit: 500 });
    expect(result.success).toBe(true);
  });

  it("accepts limit of 1", () => {
    const result = schema.safeParse({ limit: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts a search query", () => {
    const result = schema.safeParse({ q: "sunset" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("sunset");
    }
  });
});

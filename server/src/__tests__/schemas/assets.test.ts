import { describe, it, expect } from "vitest";
import {
  assetParamsSchema,
  getAssetSchema,
  updateTagsSchema,
  updateFavoriteSchema,
  batchFavoritesSchema,
} from "../../schemas/assets.js";

const validObjectId = "507f1f77bcf86cd799439011";

describe("assetParamsSchema", () => {
  const schema = assetParamsSchema.params;

  it("accepts a valid 24-char hex ObjectId", () => {
    const result = schema.safeParse({ id: validObjectId });
    expect(result.success).toBe(true);
  });

  it("accepts uppercase hex ObjectId", () => {
    const result = schema.safeParse({ id: "507F1F77BCF86CD799439011" });
    expect(result.success).toBe(true);
  });

  it("rejects a 23-char string", () => {
    const result = schema.safeParse({ id: "507f1f77bcf86cd79943901" });
    expect(result.success).toBe(false);
  });

  it("rejects a 25-char string", () => {
    const result = schema.safeParse({ id: "507f1f77bcf86cd7994390111" });
    expect(result.success).toBe(false);
  });

  it("rejects non-hex characters", () => {
    const result = schema.safeParse({ id: "507f1f77bcf86cd79943901g" });
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = schema.safeParse({ id: "" });
    expect(result.success).toBe(false);
  });
});

describe("getAssetSchema", () => {
  it("accepts valid params and optional include", () => {
    const params = getAssetSchema.params.safeParse({ id: validObjectId });
    const qs = getAssetSchema.querystring.safeParse({ include: "exif" });
    expect(params.success).toBe(true);
    expect(qs.success).toBe(true);
  });

  it("accepts without include", () => {
    const qs = getAssetSchema.querystring.safeParse({});
    expect(qs.success).toBe(true);
  });
});

describe("updateTagsSchema", () => {
  const bodySchema = updateTagsSchema.body;

  it("accepts valid tags array", () => {
    const result = bodySchema.safeParse({ tags: ["sunset", "beach"] });
    expect(result.success).toBe(true);
  });

  it("accepts empty tags array", () => {
    const result = bodySchema.safeParse({ tags: [] });
    expect(result.success).toBe(true);
  });

  it("rejects tags array exceeding 100 items", () => {
    const tags = Array.from({ length: 101 }, (_, i) => `tag${i}`);
    const result = bodySchema.safeParse({ tags });
    expect(result.success).toBe(false);
  });

  it("accepts tags array with exactly 100 items", () => {
    const tags = Array.from({ length: 100 }, (_, i) => `tag${i}`);
    const result = bodySchema.safeParse({ tags });
    expect(result.success).toBe(true);
  });

  it("rejects a tag longer than 64 characters", () => {
    const result = bodySchema.safeParse({ tags: ["a".repeat(65)] });
    expect(result.success).toBe(false);
  });

  it("accepts a tag of exactly 64 characters", () => {
    const result = bodySchema.safeParse({ tags: ["a".repeat(64)] });
    expect(result.success).toBe(true);
  });
});

describe("updateFavoriteSchema", () => {
  const bodySchema = updateFavoriteSchema.body;

  it("accepts favorite=true", () => {
    const result = bodySchema.safeParse({ favorite: true });
    expect(result.success).toBe(true);
  });

  it("accepts favorite=false", () => {
    const result = bodySchema.safeParse({ favorite: false });
    expect(result.success).toBe(true);
  });

  it("rejects non-boolean favorite", () => {
    const result = bodySchema.safeParse({ favorite: "true" });
    expect(result.success).toBe(false);
  });

  it("rejects missing favorite", () => {
    const result = bodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("batchFavoritesSchema", () => {
  const bodySchema = batchFavoritesSchema.body;

  it("accepts valid payload", () => {
    const result = bodySchema.safeParse({
      ids: [validObjectId],
      favorite: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty ids array", () => {
    const result = bodySchema.safeParse({
      ids: [],
      favorite: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects ids exceeding 500", () => {
    const ids = Array.from({ length: 501 }, () => validObjectId);
    const result = bodySchema.safeParse({ ids, favorite: true });
    expect(result.success).toBe(false);
  });

  it("accepts ids with exactly 500 items", () => {
    const ids = Array.from({ length: 500 }, () => validObjectId);
    const result = bodySchema.safeParse({ ids, favorite: true });
    expect(result.success).toBe(true);
  });

  it("rejects invalid ObjectIds in ids array", () => {
    const result = bodySchema.safeParse({
      ids: ["not-an-objectid"],
      favorite: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing favorite", () => {
    const result = bodySchema.safeParse({
      ids: [validObjectId],
    });
    expect(result.success).toBe(false);
  });
});

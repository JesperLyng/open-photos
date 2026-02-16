import { describe, expect, it } from "vitest";
import {
  createAlbumShareSchema,
  createAssetShareSchema,
  publicShareAssetSchema,
  publicShareSchema,
} from "../../schemas/shares.js";

const validObjectId = "507f1f77bcf86cd799439011";
const validToken = "abcDEF_1234567890-zyxWVUTSRQPONMLKJIHGFEDCBA";

describe("createAssetShareSchema", () => {
  it("accepts valid params", () => {
    const result = createAssetShareSchema.params.safeParse({ id: validObjectId });
    expect(result.success).toBe(true);
  });

  it("rejects invalid object id", () => {
    const result = createAssetShareSchema.params.safeParse({ id: "invalid" });
    expect(result.success).toBe(false);
  });
});

describe("createAlbumShareSchema", () => {
  it("accepts valid params", () => {
    const result = createAlbumShareSchema.params.safeParse({ id: validObjectId });
    expect(result.success).toBe(true);
  });

  it("rejects invalid object id", () => {
    const result = createAlbumShareSchema.params.safeParse({ id: "invalid" });
    expect(result.success).toBe(false);
  });
});

describe("publicShareSchema", () => {
  it("accepts valid token", () => {
    const result = publicShareSchema.params.safeParse({ token: validToken });
    expect(result.success).toBe(true);
  });

  it("rejects token with invalid chars", () => {
    const result = publicShareSchema.params.safeParse({ token: "abc+def==" });
    expect(result.success).toBe(false);
  });
});

describe("publicShareAssetSchema", () => {
  it("accepts valid params and include query", () => {
    const params = publicShareAssetSchema.params.safeParse({
      token: validToken,
      assetId: validObjectId,
    });
    const query = publicShareAssetSchema.querystring.safeParse({ include: "preview,original" });
    expect(params.success).toBe(true);
    expect(query.success).toBe(true);
  });

  it("accepts empty query", () => {
    const query = publicShareAssetSchema.querystring.safeParse({});
    expect(query.success).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import {
  createAlbumSchema,
  updateAlbumSchema,
  albumItemsSchema,
  albumParamsSchema,
} from "../../schemas/albums.js";

const validObjectId = "507f1f77bcf86cd799439011";

describe("albumParamsSchema", () => {
  const schema = albumParamsSchema.params;

  it("accepts a valid ObjectId", () => {
    const result = schema.safeParse({ id: validObjectId });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid ObjectId", () => {
    const result = schema.safeParse({ id: "invalid" });
    expect(result.success).toBe(false);
  });
});

describe("createAlbumSchema", () => {
  const schema = createAlbumSchema.body;

  it("accepts a valid name", () => {
    const result = schema.safeParse({ name: "Vacation 2024" });
    expect(result.success).toBe(true);
  });

  it("trims the name", () => {
    const result = schema.safeParse({ name: "  Vacation 2024  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Vacation 2024");
    }
  });

  it("rejects empty name", () => {
    const result = schema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 64 characters", () => {
    const result = schema.safeParse({ name: "a".repeat(65) });
    expect(result.success).toBe(false);
  });

  it("accepts name of exactly 64 characters", () => {
    const result = schema.safeParse({ name: "a".repeat(64) });
    expect(result.success).toBe(true);
  });

  it("defaults description to empty string", () => {
    const result = schema.safeParse({ name: "Album" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
    }
  });

  it("trims the description", () => {
    const result = schema.safeParse({
      name: "Album",
      description: "  A nice album  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("A nice album");
    }
  });

  it("rejects description exceeding 256 characters", () => {
    const result = schema.safeParse({
      name: "Album",
      description: "a".repeat(257),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateAlbumSchema", () => {
  const bodySchema = updateAlbumSchema.body;

  it("accepts name only", () => {
    const result = bodySchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts description only", () => {
    const result = bodySchema.safeParse({ description: "New desc" });
    expect(result.success).toBe(true);
  });

  it("accepts both name and description", () => {
    const result = bodySchema.safeParse({
      name: "New Name",
      description: "New desc",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object (requires at least one field)", () => {
    const result = bodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("trims name and description", () => {
    const result = bodySchema.safeParse({
      name: "  Trimmed  ",
      description: "  Also trimmed  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Trimmed");
      expect(result.data.description).toBe("Also trimmed");
    }
  });
});

describe("albumItemsSchema", () => {
  const bodySchema = albumItemsSchema.body;

  it("accepts valid array of ObjectIds", () => {
    const result = bodySchema.safeParse({
      ids: [validObjectId, "607f1f77bcf86cd799439012"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty ids array", () => {
    const result = bodySchema.safeParse({ ids: [] });
    expect(result.success).toBe(false);
  });

  it("rejects ids exceeding 500", () => {
    const ids = Array.from({ length: 501 }, () => validObjectId);
    const result = bodySchema.safeParse({ ids });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 500 ids", () => {
    const ids = Array.from({ length: 500 }, () => validObjectId);
    const result = bodySchema.safeParse({ ids });
    expect(result.success).toBe(true);
  });

  it("rejects invalid ObjectIds in array", () => {
    const result = bodySchema.safeParse({ ids: ["not-valid"] });
    expect(result.success).toBe(false);
  });
});

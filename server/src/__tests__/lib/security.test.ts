import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config to avoid dotenv side effects
vi.mock("../../lib/config.js", () => ({
  config: {
    allowedOrigins: "http://localhost:5173,https://app.example.com",
  },
}));

import {
  ALLOWED_MIME_TYPES,
  corsConfig,
  authRateLimit,
  uploadRateLimit,
  helmetConfig,
} from "../../lib/security.js";

describe("ALLOWED_MIME_TYPES", () => {
  it("contains expected image types", () => {
    expect(ALLOWED_MIME_TYPES.has("image/jpeg")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/png")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/heic")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/heif")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("image/webp")).toBe(true);
  });

  it("contains expected video types", () => {
    expect(ALLOWED_MIME_TYPES.has("video/mp4")).toBe(true);
    expect(ALLOWED_MIME_TYPES.has("video/quicktime")).toBe(true);
  });

  it("rejects disallowed types", () => {
    expect(ALLOWED_MIME_TYPES.has("application/pdf")).toBe(false);
    expect(ALLOWED_MIME_TYPES.has("text/plain")).toBe(false);
    expect(ALLOWED_MIME_TYPES.has("image/gif")).toBe(false);
    expect(ALLOWED_MIME_TYPES.has("image/svg+xml")).toBe(false);
  });

  it("has exactly 7 allowed types", () => {
    expect(ALLOWED_MIME_TYPES.size).toBe(7);
  });
});

describe("corsConfig", () => {
  it("parses origin from comma-separated config", () => {
    expect(corsConfig.origin).toEqual([
      "http://localhost:5173",
      "https://app.example.com",
    ]);
  });

  it("has credentials enabled", () => {
    expect(corsConfig.credentials).toBe(true);
  });
});

describe("authRateLimit", () => {
  it("has expected max and timeWindow", () => {
    expect(authRateLimit.max).toBe(10);
    expect(authRateLimit.timeWindow).toBe("1 minute");
  });
});

describe("uploadRateLimit", () => {
  it("has expected max and timeWindow", () => {
    expect(uploadRateLimit.max).toBe(50);
    expect(uploadRateLimit.timeWindow).toBe("1 minute");
  });
});

describe("helmetConfig", () => {
  it("has content security policy directives", () => {
    expect(helmetConfig.contentSecurityPolicy.directives).toBeDefined();
    expect(helmetConfig.contentSecurityPolicy.directives.defaultSrc).toContain("'self'");
  });

  it("has cross-origin resource policy set to cross-origin", () => {
    expect(helmetConfig.crossOriginResourcePolicy.policy).toBe("cross-origin");
  });
});

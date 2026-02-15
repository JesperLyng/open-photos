import { describe, it, expect } from "vitest";
import { oidcClaimsSchema } from "../../schemas/auth.js";

describe("oidcClaimsSchema", () => {
  const validClaims = {
    sub: "user-123",
    iss: "https://auth.example.com",
    aud: "my-client",
  };

  it("accepts a valid minimal OIDC payload", () => {
    const result = oidcClaimsSchema.safeParse(validClaims);
    expect(result.success).toBe(true);
  });

  it("accepts a full OIDC payload with all optional fields", () => {
    const result = oidcClaimsSchema.safeParse({
      ...validClaims,
      email: "user@example.com",
      email_verified: true,
      name: "Test User",
      preferred_username: "testuser",
      given_name: "Test",
      picture: "https://example.com/avatar.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("allows extra fields via passthrough", () => {
    const result = oidcClaimsSchema.safeParse({
      ...validClaims,
      custom_claim: "custom-value",
      nonce: "abc123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).custom_claim).toBe("custom-value");
    }
  });

  it("rejects missing sub", () => {
    const { sub, ...rest } = validClaims;
    const result = oidcClaimsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing iss", () => {
    const { iss, ...rest } = validClaims;
    const result = oidcClaimsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing aud", () => {
    const { aud, ...rest } = validClaims;
    const result = oidcClaimsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("accepts aud as a string", () => {
    const result = oidcClaimsSchema.safeParse({
      ...validClaims,
      aud: "single-audience",
    });
    expect(result.success).toBe(true);
  });

  it("accepts aud as a string array", () => {
    const result = oidcClaimsSchema.safeParse({
      ...validClaims,
      aud: ["audience-1", "audience-2"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid email format", () => {
    const result = oidcClaimsSchema.safeParse({
      ...validClaims,
      email: "valid@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = oidcClaimsSchema.safeParse({
      ...validClaims,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});

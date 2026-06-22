import { describe, expect, it } from "vitest";
import { bearerTokenFromRequest } from "./auth-token";

describe("bearerTokenFromRequest", () => {
  it("extracts a bearer token", () => {
    const request = new Request("http://localhost/api/auth/me", {
      headers: { Authorization: "Bearer api-token" },
    });

    expect(bearerTokenFromRequest(request)).toBe("api-token");
  });

  it("accepts a case-insensitive bearer scheme", () => {
    const request = new Request("http://localhost/api/auth/me", {
      headers: { Authorization: "bearer api-token" },
    });

    expect(bearerTokenFromRequest(request)).toBe("api-token");
  });

  it("rejects malformed authorization headers", () => {
    const request = new Request("http://localhost/api/auth/me", {
      headers: { Authorization: "Basic api-token" },
    });

    expect(bearerTokenFromRequest(request)).toBeNull();
  });
});

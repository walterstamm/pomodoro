import { afterEach, describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./allowed-origin";

const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
const originalAppOrigin = process.env.APP_ORIGIN;

afterEach(() => {
  process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
  process.env.APP_ORIGIN = originalAppOrigin;
});

describe("rejectUntrustedOrigin", () => {
  it("allows an exact configured origin", () => {
    process.env.APP_ORIGIN = "";
    process.env.ALLOWED_ORIGINS = "https://pomodoro.example.com";

    expect(isAllowedOrigin("https://pomodoro.example.com")).toBe(true);
  });

  it("allows any explicit localhost port", () => {
    process.env.APP_ORIGIN = "";
    process.env.ALLOWED_ORIGINS =
      "http://localhost:*,http://127.0.0.1:*";

    expect(isAllowedOrigin("http://localhost:8082")).toBe(true);
    expect(isAllowedOrigin("http://127.0.0.1:5173")).toBe(true);
  });

  it("rejects origins outside the configured hosts", () => {
    process.env.APP_ORIGIN = "";
    process.env.ALLOWED_ORIGINS = "http://localhost:*";

    expect(isAllowedOrigin("http://example.com:8082")).toBe(false);
  });

  it("keeps APP_ORIGIN allowed when extra origins are configured", () => {
    process.env.APP_ORIGIN = "https://pomodoro.example.com";
    process.env.ALLOWED_ORIGINS = "http://localhost:*";

    expect(isAllowedOrigin("https://pomodoro.example.com")).toBe(true);
    expect(isAllowedOrigin("http://localhost:8082")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { computeRemainingSeconds, minutesBetween } from "./time";

describe("time helpers", () => {
  it("computeRemainingSeconds clamps at zero when past end", () => {
    const now = Date.now();
    const end = new Date(now - 5000);
    expect(computeRemainingSeconds(end, now)).toBe(0);
  });

  it("computeRemainingSeconds rounds to nearest second", () => {
    const now = Date.now();
    const end = new Date(now + 1499);
    expect(computeRemainingSeconds(end, now)).toBe(1);
  });

  it("minutesBetween rounds and enforces minimum 1 minute", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-01T00:00:20Z");
    expect(minutesBetween(start, end)).toBe(1);
  });

  it("minutesBetween returns rounded minutes", () => {
    const start = new Date("2024-01-01T00:00:00Z");
    const end = new Date("2024-01-01T00:19:40Z");
    expect(minutesBetween(start, end)).toBe(20);
  });
});

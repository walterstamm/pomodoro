import { describe, expect, it } from "vitest";
import { completedSessionMinutes, computeRemainingSeconds } from "./time";

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

  it("completedSessionMinutes rounds and enforces minimum 1 minute", () => {
    expect(completedSessionMinutes(25 * 60, 25 * 60 - 20)).toBe(1);
  });

  it("completedSessionMinutes uses consumed timer time", () => {
    expect(completedSessionMinutes(25 * 60, 5 * 60 + 20)).toBe(20);
  });

  it("completedSessionMinutes excludes time spent paused", () => {
    const configuredSeconds = 30 * 60;
    const remainingAfterTenActiveMinutes = 20 * 60;

    expect(
      completedSessionMinutes(
        configuredSeconds,
        remainingAfterTenActiveMinutes,
      ),
    ).toBe(10);
  });
});

import { describe, expect, it } from "vitest";
import { lapBoundary, lapCenter, lapSpan, lapTicks } from "./chart";

// Singapore: 62 laps, forecast V1–16 / V17–40 / V41–62, strategy 24 + 19 + 19.
const LAPS = 62;
const pct = (fraction: number) => Number((fraction * 100).toFixed(2));

describe("lap bar scale", () => {
  it("sizes weather segments only by their laps", () => {
    expect([lapSpan(1, 16, LAPS), lapSpan(17, 40, LAPS), lapSpan(41, 62, LAPS)].map((s) => pct(s.size))).toEqual([
      25.81, 38.71, 35.48,
    ]);
  });

  it("sizes strategy stints on the same scale", () => {
    expect([lapSpan(1, 24, LAPS), lapSpan(25, 43, LAPS), lapSpan(44, 62, LAPS)].map((s) => pct(s.size))).toEqual([
      38.71, 30.65, 30.65,
    ]);
  });

  it("tiles the bar without gaps or overlaps", () => {
    const stints = [lapSpan(1, 24, LAPS), lapSpan(25, 43, LAPS), lapSpan(44, 62, LAPS)];
    expect(stints[0].start).toBe(0);
    expect(stints[1].start).toBeCloseTo(stints[0].start + stints[0].size, 12);
    expect(stints[2].start).toBeCloseTo(stints[1].start + stints[1].size, 12);
    expect(stints[2].start + stints[2].size).toBeCloseTo(1, 12);
  });

  it("puts a pit stop between the last lap of a stint and the first of the next", () => {
    // Stop at the end of lap 24: end of stint 1 and start of stint 2.
    expect(lapBoundary(24, LAPS)).toBeCloseTo(lapSpan(25, 43, LAPS).start, 12);
    expect(lapBoundary(24, LAPS)).toBeGreaterThan(lapCenter(24, LAPS));
    expect(lapBoundary(24, LAPS)).toBeLessThan(lapCenter(25, LAPS));
    expect(pct(lapBoundary(43, LAPS))).toBe(69.35);
  });

  it("places lap labels in the middle of their lap, not on the point scale", () => {
    expect(lapCenter(1, LAPS)).toBeCloseTo(0.5 / 62, 12);
    expect(lapCenter(62, LAPS)).toBeCloseTo(61.5 / 62, 12);
  });

  it("clamps laps outside the race and handles an empty race", () => {
    const beyondEnd = lapSpan(50, 70, LAPS);
    expect(beyondEnd.start).toBeCloseTo(49 / 62, 12);
    expect(beyondEnd.size).toBeCloseTo(13 / 62, 12);
    expect(lapSpan(63, 70, LAPS).size).toBe(0);
    expect(lapSpan(1, 10, 0)).toEqual({ start: 0, size: 0 });
  });
});

describe("lapTicks", () => {
  it("labels the first lap, every ten laps and the last one, skipping a crowded 60", () => {
    expect(lapTicks(62)).toEqual([1, 10, 20, 30, 40, 50, 62]);
  });
});

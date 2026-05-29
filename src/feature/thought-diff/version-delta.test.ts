import { describe, it, expect } from "vitest";
import { computeVersionDelta } from "@/feature/thought-diff/version-delta";

describe("computeVersionDelta", () => {
  it("returns empty delta when content is unchanged", () => {
    const delta = computeVersionDelta("same text here", "same text here");

    expect(delta.addedWords).toEqual([]);
    expect(delta.removedWords).toEqual([]);
    expect(delta.metrics).toEqual({
      addedWordsCount: 0,
      removedWordsCount: 0,
      totalChanges: 0,
    });
  });

  it("detects added and removed words between versions", () => {
    const delta = computeVersionDelta(
      "Old version content",
      "New version content"
    );

    expect(delta.removedWords).toContain("Old");
    expect(delta.addedWords).toContain("New");
    expect(delta.metrics.addedWordsCount).toBeGreaterThan(0);
    expect(delta.metrics.removedWordsCount).toBeGreaterThan(0);
    expect(delta.metrics.totalChanges).toBe(
      delta.metrics.addedWordsCount + delta.metrics.removedWordsCount
    );
  });

  it("ignores whitespace-only tokens", () => {
    const delta = computeVersionDelta("hello", "hello   world");

    expect(delta.addedWords).toEqual(["world"]);
    expect(delta.removedWords).toEqual([]);
  });

  it("tracks pure additions", () => {
    const delta = computeVersionDelta("alpha", "alpha beta gamma");

    expect(delta.removedWords).toEqual([]);
    expect(delta.addedWords).toEqual(["beta", "gamma"]);
    expect(delta.metrics).toEqual({
      addedWordsCount: 2,
      removedWordsCount: 0,
      totalChanges: 2,
    });
  });

  it("tracks pure removals", () => {
    const delta = computeVersionDelta("alpha beta gamma", "alpha");

    expect(delta.addedWords).toEqual([]);
    expect(delta.removedWords).toEqual(["beta", "gamma"]);
    expect(delta.metrics).toEqual({
      addedWordsCount: 0,
      removedWordsCount: 2,
      totalChanges: 2,
    });
  });
});

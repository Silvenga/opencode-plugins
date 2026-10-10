import { describe, expect, test } from "vitest";
import { parseOptions } from "./parse-options.js";

describe("parseOptions", () => {
  test("When options are empty then parseOptions should default minTokens to 400", () => {
    expect(parseOptions({})).toEqual({ minTokens: 400 });
  });

  test("When minTokens is a positive number then parseOptions should keep it", () => {
    expect(parseOptions({ minTokens: 1000 })).toEqual({ minTokens: 1000 });
  });

  test.each([0, -5, 0.5, 400.7, Number.POSITIVE_INFINITY, Number.NaN, "big"])(
    "When minTokens is %j then parseOptions should default it",
    (minTokens) => {
      expect(parseOptions({ minTokens }).minTokens).toBe(400);
    },
  );

  test("When options are missing or null then parseOptions should use defaults", () => {
    expect(parseOptions(undefined)).toEqual({ minTokens: 400 });
    expect(parseOptions(null)).toEqual({ minTokens: 400 });
  });
});

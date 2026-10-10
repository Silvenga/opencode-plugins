import { describe, expect, test } from "vitest";
import { scrub } from "./scrub.js";

describe("scrub", () => {
  test("When an id contains wire-unsafe characters then scrub should replace them with underscores", () => {
    expect(scrub("tool_01a.bcd!")).toBe("tool_01a_bcd_");
  });

  test("When an id is already wire-safe then scrub should return it unchanged", () => {
    expect(scrub("tool_01Abc-XYZ_9")).toBe("tool_01Abc-XYZ_9");
  });
});

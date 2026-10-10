import { describe, expect, test } from "vitest";
import { skill } from "./skill.js";

describe("skill", () => {
  test("When registering then skill should carry the spec's teaching points", () => {
    const info = skill();

    expect(info.id).toBe("context-trim");
    expect(info.autoinvoke).toBe(true);
    expect(info.description).toContain("context.forget");
    expect(info.description).toContain("context.restore");
  });
});

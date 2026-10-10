import { describe, expect, test } from "vitest";
import { skill } from "./skill.js";

describe("skill", () => {
  test("When registering then skill should carry the spec's teaching points", () => {
    const info = skill();

    expect(info.id).toBe("context-trim");
    expect(info.autoinvoke).toBe(true);
    expect(info.description).toContain("context.forget");
    expect(info.content).toContain("tool call block");
    expect(info.content).toContain("Only trim calls whose result you have already seen");
    expect(info.content).toContain("Superseded file reads");
    expect(info.content).toContain("Never trim the newest read of a resource");
    expect(info.content).toContain("a future turn can act on");
    expect(info.content).toContain("Batch several targets into one call");
    expect(info.content).toContain("context.restore");
  });
});

import { describe, expect, test } from "vitest";
import { entries, findSchema } from "./schema-registry.js";

describe("registry", () => {
  test("When the registry is read then it should contain model-providers", () => {
    const names = entries().map((entry) => entry.name);
    expect(names).toContain("model-providers");
  });

  test("When a registered name is looked up then findSchema should return its schema", () => {
    const schema = findSchema("model-providers");
    expect(schema).toBeDefined();
    expect(schema?.safeParse({ providers: {} }).success).toBe(true);
  });

  test("When an unregistered name is looked up then findSchema should return undefined", () => {
    expect(findSchema("not-a-plugin")).toBeUndefined();
  });

  test("When the registry is read then names should be unique", () => {
    const names = entries().map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

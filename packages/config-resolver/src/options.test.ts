import { describe, expect, test } from "vitest";
import { parseOptions } from "./options.js";

describe("parseOptions", () => {
  test("When options are empty then parseOptions should return defaults", () => {
    expect(parseOptions({})).toEqual({ paths: [], timeoutMs: 5000, vars: {} });
  });

  test("When paths is an array of strings then parseOptions should keep them", () => {
    expect(parseOptions({ paths: ["/a.yaml", "~/.b.yaml"] })).toEqual({
      paths: ["/a.yaml", "~/.b.yaml"],
      timeoutMs: 5000,
      vars: {},
    });
  });

  test("When paths contains non-strings then parseOptions should drop them", () => {
    expect(parseOptions({ paths: ["/a.yaml", 42, null, true] })).toEqual({
      paths: ["/a.yaml"],
      timeoutMs: 5000,
      vars: {},
    });
  });

  test("When paths is not an array then parseOptions should default to empty", () => {
    expect(parseOptions({ paths: "/a.yaml" })).toEqual({ paths: [], timeoutMs: 5000, vars: {} });
  });

  test("When timeoutMs is a positive number then parseOptions should keep it", () => {
    expect(parseOptions({ timeoutMs: 1000 })).toEqual({ paths: [], timeoutMs: 1000, vars: {} });
  });

  test("When timeoutMs is zero or negative then parseOptions should default it", () => {
    expect(parseOptions({ timeoutMs: 0 }).timeoutMs).toBe(5000);
    expect(parseOptions({ timeoutMs: -5 }).timeoutMs).toBe(5000);
  });

  test("When timeoutMs is not a finite number then parseOptions should default it", () => {
    expect(parseOptions({ timeoutMs: Number.POSITIVE_INFINITY }).timeoutMs).toBe(5000);
    expect(parseOptions({ timeoutMs: "slow" }).timeoutMs).toBe(5000);
  });

  test("When vars contains only strings then parseOptions should preserve every entry", () => {
    const vars = { KEY: "value", EMPTY: "", LITERAL: "$(env:KEY)\nline two", constructor: "own" };

    const parsed = parseOptions({ vars });

    expect(parsed.vars).toEqual(vars);
  });

  test.each([
    undefined,
    null,
    [],
    ["value"],
    "value",
    42,
    true,
    { KEY: "valid", INVALID: 42 },
    { KEY: "valid", INVALID: null },
    { KEY: "valid", INVALID: {} },
  ])("When vars is invalid %j then parseOptions should default the whole map", (vars) => {
    const parsed = parseOptions({ vars, paths: ["/config.yaml"], timeoutMs: 1000 });

    expect(parsed).toEqual({ paths: ["/config.yaml"], timeoutMs: 1000, vars: {} });
  });
});

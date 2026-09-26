import { describe, expect, test } from "vitest";
import { parseDocuments, parseDocumentResults } from "./documents.js";

describe("parseDocuments", () => {
  test("When a file has multiple documents then parseDocuments should return each named config in order", () => {
    const yaml = `
---
name: one
config:
  key: value
---
name: two
config:
  - a
  - b
`;
    expect(parseDocuments(yaml)).toEqual([
      { name: "one", config: { key: "value" } },
      { name: "two", config: ["a", "b"] },
    ]);
  });

  test("When a document omits config then parseDocuments should default it to an empty object", () => {
    expect(parseDocuments("name: bare")).toEqual([{ name: "bare", config: {} }]);
  });

  test("When a document config is null then parseDocuments should store an empty object", () => {
    expect(parseDocuments("name: empty\nconfig: null")).toEqual([{ name: "empty", config: {} }]);
  });

  test("When a document config is a scalar then parseDocuments should keep it", () => {
    expect(parseDocuments("name: scalar\nconfig: 42")).toEqual([{ name: "scalar", config: 42 }]);
  });

  test("When a document carries extra keys then parseDocuments should ignore them", () => {
    expect(parseDocuments("name: doc\nextra: ignored\nconfig: {a: 1}")).toEqual([
      { name: "doc", config: { a: 1 } },
    ]);
  });

  test("When a document is not an object then parseDocuments should throw", () => {
    expect(() => parseDocuments("- just\n- a\n- list")).toThrow(/document/i);
  });

  test("When a document has no name then parseDocuments should throw", () => {
    expect(() => parseDocuments("config: {a: 1}")).toThrow(/name/i);
  });

  test("When a document name is empty then parseDocuments should throw", () => {
    expect(() => parseDocuments('name: ""\nconfig: {}')).toThrow(/name/i);
  });

  test("When a document name is not a string then parseDocuments should throw", () => {
    expect(() => parseDocuments("name: 42\nconfig: {}")).toThrow(/name/i);
  });

  test("When yaml is invalid then parseDocuments should throw", () => {
    expect(() => parseDocuments("key: [unclosed")).toThrow();
  });

  test("When yaml contains an explicit timestamp tag then parseDocuments should throw", () => {
    expect(() => parseDocuments("name: t\nconfig:\n  when: !!timestamp 2001-12-14")).toThrow();
  });

  test("When yaml contains an explicit binary scalar then parseDocuments should throw", () => {
    expect(() => parseDocuments("name: b\nconfig: !!binary aGk=")).toThrow();
  });

  test("When a plain date-like scalar appears then parseDocuments should keep it as a string", () => {
    expect(parseDocuments("name: d\nconfig:\n  when: 2001-12-14")).toEqual([
      { name: "d", config: { when: "2001-12-14" } },
    ]);
  });

  test("When a file contains only comments then parseDocuments should return zero documents", () => {
    expect(parseDocuments("# nothing here\n")).toEqual([]);
  });

  test("When duplicate names appear in one file then parseDocuments should keep both for later merging", () => {
    const yaml = `
---
name: dup
config: first
---
name: dup
config: second
`;
    expect(parseDocuments(yaml)).toEqual([
      { name: "dup", config: "first" },
      { name: "dup", config: "second" },
    ]);
  });
});

test("When a file ends with a trailing separator then parseDocuments should skip the empty document", () => {
  expect(parseDocuments("name: a\nconfig: 1\n---\n")).toEqual([{ name: "a", config: 1 }]);
});

test("When a file contains an empty document mid-file then parseDocuments should skip it", () => {
  const yaml = `
---
name: one
config: 1
---
---
name: two
config: 2
`;
  expect(parseDocuments(yaml)).toEqual([
    { name: "one", config: 1 },
    { name: "two", config: 2 },
  ]);
});

describe("parseDocumentResults", () => {
  test("When all documents are valid then parseDocumentResults should return each config with no errors", () => {
    const yaml = `
---
name: one
config: 1
---
name: two
config: 2
`;
    expect(parseDocumentResults(yaml)).toEqual([
      { name: "one", config: 1 },
      { name: "two", config: 2 },
    ]);
  });

  test("When one document is invalid then parseDocumentResults should keep its position and return an error for it", () => {
    const yaml = `
---
name: one
config: 1
---
name: ""
config: 2
---
name: two
config: 3
`;
    const results = parseDocumentResults(yaml);
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ name: "one", config: 1 });
    expect("error" in (results[1] ?? { name: "", config: undefined })).toBe(true);
    expect(results[2]).toEqual({ name: "two", config: 3 });
  });

  test("When the yaml cannot be parsed then parseDocumentResults should return one error result", () => {
    const results = parseDocumentResults("key: [unclosed");
    expect(results).toHaveLength(1);
    expect("error" in (results[0] ?? { name: "", config: undefined })).toBe(true);
  });

  test("When a document is not an object then parseDocumentResults should return an error result for it", () => {
    const yaml = `
---
name: one
config: 1
---
- just
- a list
`;
    const results = parseDocumentResults(yaml);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ name: "one", config: 1 });
    expect("error" in (results[1] ?? { name: "", config: undefined })).toBe(true);
  });

  test("When a file contains empty documents then parseDocumentResults should skip them", () => {
    expect(parseDocumentResults("name: a\nconfig: 1\n---\n")).toEqual([{ name: "a", config: 1 }]);
  });

  test("When a config value is not JSON compatible then parseDocumentResults should return an error result", () => {
    const yaml = `
---
name: t
config:
  when: !!timestamp 2001-12-14
`;
    const results = parseDocumentResults(yaml);
    expect(results).toHaveLength(1);
    expect("error" in (results[0] ?? { name: "", config: undefined })).toBe(true);
  });
});

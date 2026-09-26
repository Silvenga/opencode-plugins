import { describe, expect, test } from "vitest";
import { entries } from "../../schema-registry.js";
import { buildUnifiedSchema } from "./export-schema.js";

interface Variant {
  readonly type?: string;
  readonly properties?: Record<string, { const?: string; [key: string]: unknown }>;
  readonly required?: string[];
  readonly additionalProperties?: unknown;
}

interface UnifiedSchema {
  readonly $schema?: string;
  readonly oneOf?: Variant[];
}

function unified(): UnifiedSchema {
  return buildUnifiedSchema() as UnifiedSchema;
}

describe("buildUnifiedSchema", () => {
  test("When the unified schema is built then it should be a draft 2020-12 oneOf over the registry", () => {
    const schema = unified();
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    const variants = schema.oneOf ?? [];
    expect(variants).toHaveLength(entries().length);
    for (const entry of entries()) {
      const variant = variants.find(
        (candidate) => candidate.properties?.name?.const === entry.name,
      );
      expect(variant).toBeDefined();
    }
  });

  test("When a variant is inspected then its name should be a const and config optional", () => {
    const schema = unified();
    const variant = (schema.oneOf ?? [])[0];
    expect(variant?.properties?.name?.const).toBe(entries()[0]?.name);
    expect(variant?.properties?.config).toBeDefined();
    expect(variant?.required).toEqual(["name"]);
  });

  test("When the unified schema is built twice then output should be deterministic", () => {
    expect(JSON.stringify(unified())).toBe(JSON.stringify(unified()));
  });

  test("When the unified schema is serialized then it should round-trip as JSON", () => {
    expect(() => JSON.parse(JSON.stringify(unified()))).not.toThrow();
  });

  test("When a variant matches a valid document then the variant should accept extra keys", () => {
    const schema = unified();
    const variant = (schema.oneOf ?? [])[0];
    expect(variant?.additionalProperties).toEqual({});
    expect(variant?.properties?.config).toMatchObject({ anyOf: expect.any(Array) });
  });
});

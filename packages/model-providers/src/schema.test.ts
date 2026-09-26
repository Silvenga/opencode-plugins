import { describe, expect, test } from "vitest";
import { pluginConfigSchema } from "./config.js";
import { schema } from "./schema.js";

describe("schema export", () => {
  test("When the schema export is read then it should expose the model-providers document name and config schema", () => {
    expect(schema.name).toBe("model-providers");
    expect(schema.schema).toBe(pluginConfigSchema);
  });

  test("When a valid config is validated then the schema should accept it", () => {
    const result = schema.schema.safeParse({ providers: {} });
    expect(result.success).toBe(true);
  });

  test("When a non-object config is validated then the schema should reject it", () => {
    const result = schema.schema.safeParse(42);
    expect(result.success).toBe(false);
  });
});

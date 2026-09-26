import { describe, expect, test } from "vitest";
import { pluginConfigSchema } from "./config.js";

describe("config schema shape", () => {
  test("When config is undefined then the schema should accept it as empty", () => {
    expect(pluginConfigSchema.parse(undefined)).toEqual({ providers: {} });
  });

  test("When config is empty then the schema should accept it with no providers", () => {
    const parsed = pluginConfigSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.providers).toEqual({});
    }
  });

  test("When config is null then the schema should accept it as empty", () => {
    const parsed = pluginConfigSchema.safeParse(null);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.providers).toEqual({});
    }
  });

  test("When config is not an object then the schema should reject it", () => {
    expect(pluginConfigSchema.safeParse("nope").success).toBe(false);
    expect(pluginConfigSchema.safeParse([]).success).toBe(false);
  });

  test("When a provider entry is an empty object then the schema should accept it", () => {
    const parsed = pluginConfigSchema.safeParse({ providers: { "my-provider": {} } });
    expect(parsed.success).toBe(true);
  });
});

describe("config schema known-field validation", () => {
  test("When suppressRegisteringIntegrations is a boolean then the schema should accept it", () => {
    const parsed = pluginConfigSchema.safeParse({ suppressRegisteringIntegrations: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.suppressRegisteringIntegrations).toBe(true);
    }
  });

  test("When suppressRegisteringIntegrations is omitted then the schema should leave it unspecified", () => {
    const parsed = pluginConfigSchema.safeParse({ providers: {} });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.suppressRegisteringIntegrations).toBeUndefined();
    }
  });

  test("When suppressRegisteringIntegrations is not a boolean then the schema should reject it", () => {
    const parsed = pluginConfigSchema.safeParse({ suppressRegisteringIntegrations: "yes" });
    expect(parsed.success).toBe(false);
  });

  test("When provider name is a string then the schema should accept it", () => {
    const parsed = pluginConfigSchema.safeParse({
      providers: { "my-provider": { name: "My Provider" } },
    });
    expect(parsed.success).toBe(true);
  });

  test("When provider name is not a string then the schema should reject it", () => {
    const parsed = pluginConfigSchema.safeParse({ providers: { p: { name: 42 } } });
    expect(parsed.success).toBe(false);
  });

  test("When provider env is a string array then the schema should accept it", () => {
    const parsed = pluginConfigSchema.safeParse({
      providers: { p: { env: ["API_KEY"] } },
    });
    expect(parsed.success).toBe(true);
  });

  test("When provider env contains a non-string then the schema should reject it", () => {
    const parsed = pluginConfigSchema.safeParse({ providers: { p: { env: ["A", 1] } } });
    expect(parsed.success).toBe(false);
  });

  test("When provider models is an object then the schema should accept it", () => {
    const parsed = pluginConfigSchema.safeParse({
      providers: { p: { models: { "m-1": { name: "M1" } } } },
    });
    expect(parsed.success).toBe(true);
  });

  test("When provider models is an array then the schema should reject it", () => {
    const parsed = pluginConfigSchema.safeParse({ providers: { p: { models: [] } } });
    expect(parsed.success).toBe(false);
  });

  test("When a model limit has nonnegative integer context and output then the schema should accept it", () => {
    const parsed = pluginConfigSchema.safeParse({
      providers: { p: { models: { m: { limit: { context: 1_000_000, output: 0 } } } } },
    });
    expect(parsed.success).toBe(true);
  });

  test("When a model limit is negative then the schema should reject it", () => {
    const parsed = pluginConfigSchema.safeParse({
      providers: { p: { models: { m: { limit: { context: -1, output: 10 } } } } },
    });
    expect(parsed.success).toBe(false);
  });

  test("When a model limit is a non-integer then the schema should reject it", () => {
    const parsed = pluginConfigSchema.safeParse({
      providers: { p: { models: { m: { limit: { context: 1.5, output: 10 } } } } },
    });
    expect(parsed.success).toBe(false);
  });

  test("When model name is not a string then the schema should reject it", () => {
    const parsed = pluginConfigSchema.safeParse({
      providers: { p: { models: { m: { name: false } } } },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("config schema passthrough", () => {
  test("When a provider carries unknown fields then the schema should accept and keep them", () => {
    const parsed = pluginConfigSchema.safeParse({
      providers: { p: { arbitrary: { nested: true }, package: "my-pkg" } },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.providers.p).toMatchObject({
        arbitrary: { nested: true },
        package: "my-pkg",
      });
    }
  });

  test("When a model carries unknown fields then the schema should accept and keep them", () => {
    const parsed = pluginConfigSchema.safeParse({
      providers: { p: { models: { m: { compatibility: { reasoningField: "reasoning" } } } } },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.providers.p?.models?.m).toMatchObject({
        compatibility: { reasoningField: "reasoning" },
      });
    }
  });

  test("When model cost entries are given then the schema should keep them verbatim", () => {
    const cost = [{ input: 1, output: 2, cache: { read: 0.1, write: 0.2 } }];
    const parsed = pluginConfigSchema.safeParse({
      providers: { p: { models: { m: { cost } } } },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.providers.p?.models?.m?.cost).toEqual(cost);
    }
  });

  test("When config contains providers and models then pluginConfigSchema should accept it", () => {
    const parsed = pluginConfigSchema.safeParse({
      providers: { p: { name: "P", models: { m: { name: "M" } } } },
    });
    expect(parsed.success).toBe(true);
  });
});

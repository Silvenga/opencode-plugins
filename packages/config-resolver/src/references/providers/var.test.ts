import { describe, expect, test } from "vitest";
import { makeVarProvider } from "./var.js";

describe("makeVarProvider", () => {
  test("When a variable is set then resolution without a base should return its value verbatim", async () => {
    const value = "line one\n$(env:TOKEN) $$ literal";
    const provider = makeVarProvider({ KEY: value });

    const resolved = await provider.resolve("KEY", undefined);

    expect(resolved).toBe(value);
  });

  test.each<Record<string, string>>([{}, { KEY: "" }])(
    "When a variable is missing or empty in %j then resolution should reject with its name",
    async (vars) => {
      const provider = makeVarProvider({ ...vars, SECRET: "secret-value" });

      const result = provider.resolve("KEY", undefined);

      await expect(result).rejects.toThrow("configured variable is not set: KEY");
      await expect(result).rejects.not.toThrow("secret-value");
    },
  );

  test.each(["constructor", "toString", "__proto__"])(
    "When %s is inherited then resolution should treat it as missing",
    async (name) => {
      const provider = makeVarProvider({});

      const result = provider.resolve(name, undefined);

      await expect(result).rejects.toThrow(`configured variable is not set: ${name}`);
    },
  );

  test.each(["constructor", "toString", "__proto__"])(
    "When %s is explicitly configured then resolution should return its value",
    async (name) => {
      const provider = makeVarProvider({ [name]: "own value" });

      const resolved = await provider.resolve(name, undefined);

      expect(resolved).toBe("own value");
    },
  );
});

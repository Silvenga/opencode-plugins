import type { ReferenceProvider } from "../scanner.js";

export function makeVarProvider(vars: Readonly<Record<string, string>>): ReferenceProvider {
  return {
    resolve: async (input) => {
      const value = Object.hasOwn(vars, input) ? vars[input] : undefined;
      if (value === undefined || value.length === 0) {
        throw new Error(`configured variable is not set: ${input}`);
      }
      return value;
    },
  };
}

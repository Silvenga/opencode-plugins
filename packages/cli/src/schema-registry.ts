import { schema as modelProviders } from "@slvnco-opencode/model-providers/schema";
import type { z } from "zod";

export interface RegistryEntry {
  readonly name: string;
  readonly schema: z.ZodType;
}

const registry: ReadonlyArray<RegistryEntry> = [modelProviders];

export function entries(): ReadonlyArray<RegistryEntry> {
  return registry;
}

export function findSchema(name: string): z.ZodType | undefined {
  return registry.find((entry) => entry.name === name)?.schema;
}

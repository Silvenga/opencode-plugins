import { z } from "zod";

const modelSchema = z.looseObject({
  name: z.string().optional(),
  modelID: z.string().optional(),
  family: z.string().optional(),
  canonical: z.string().optional(),
  package: z.string().optional(),
  enabled: z.boolean().optional(),
  disabled: z.boolean().optional(),
  limit: z
    .looseObject({
      context: z.number().int().nonnegative().optional(),
      input: z.number().int().nonnegative().optional(),
      output: z.number().int().nonnegative().optional(),
    })
    .optional(),
  cost: z.array(z.json()).optional(),
  capabilities: z
    .looseObject({
      tools: z.boolean().optional(),
      input: z.array(z.string()).optional(),
      output: z.array(z.string()).optional(),
    })
    .optional(),
  variants: z.array(z.json()).optional(),
  settings: z.json().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.record(z.string(), z.json()).optional(),
});

const providerSchema = z.looseObject({
  name: z.string().optional(),
  canonical: z.string().optional(),
  env: z.array(z.string()).optional(),
  package: z.string().optional(),
  settings: z.json().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.record(z.string(), z.json()).optional(),
  models: z.record(z.string(), modelSchema).optional(),
});

export const pluginConfigSchema = z
  .looseObject({
    providers: z.record(z.string(), providerSchema).optional(),
    suppressRegisteringIntegrations: z.boolean().optional(),
  })
  .nullish()
  .transform((config) => {
    const suppress = config?.suppressRegisteringIntegrations;
    return suppress == null
      ? { providers: config?.providers ?? {} }
      : { providers: config?.providers ?? {}, suppressRegisteringIntegrations: suppress };
  });

export type PluginConfig = z.output<typeof pluginConfigSchema>;
export type ProviderConfig = z.output<typeof providerSchema>;
export type ModelConfig = z.output<typeof modelSchema>;

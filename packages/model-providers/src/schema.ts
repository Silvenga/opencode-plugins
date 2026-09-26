import { pluginConfigSchema } from "./config.js";

export const schema = {
  name: "model-providers",
  schema: pluginConfigSchema,
} as const;

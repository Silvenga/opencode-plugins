import { z } from "zod";
import { entries } from "../../schema-registry.js";

export function buildUnifiedSchema(): Record<string, unknown> {
  const variants = entries().map((entry) =>
    z.looseObject({
      name: z.literal(entry.name),
      config: entry.schema.optional(),
    }),
  );
  const union = z.union(variants);
  const schema = z.toJSONSchema(union, { io: "input" }) as Record<string, unknown>;
  const anyOf = schema.anyOf;
  if (anyOf === undefined) {
    return schema;
  }
  const { anyOf: _omit, ...rest } = schema;
  return { ...rest, oneOf: anyOf };
}

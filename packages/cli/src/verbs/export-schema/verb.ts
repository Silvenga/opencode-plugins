import type { Output } from "../../output.js";
import { buildUnifiedSchema } from "./export-schema.js";

export function exportSchemaVerb(output: Output): void {
  output.out(`${JSON.stringify(buildUnifiedSchema(), null, 2)}\n`);
}

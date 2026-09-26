import type { Output } from "../../output.js";
import { makeRuntime } from "./runtime.js";
import { validateFile } from "./validate.js";

export async function validateVerb(file: string, output: Output): Promise<number> {
  return validateFile(file, makeRuntime(), (line) => output.out(`${line}\n`));
}

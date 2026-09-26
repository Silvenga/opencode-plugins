import { parseAllDocuments } from "yaml";

export interface NamedConfig {
  readonly name: string;
  readonly config: unknown;
}

export type DocumentResult = NamedConfig | { readonly error: Error };

export function parseDocuments(yaml: string): NamedConfig[] {
  const configs: NamedConfig[] = [];
  for (const result of parseDocumentResults(yaml)) {
    if ("error" in result) {
      throw result.error;
    }
    configs.push(result);
  }
  return configs;
}

export function parseDocumentResults(yaml: string): DocumentResult[] {
  const documents = parseAllDocuments(yaml);
  const results: DocumentResult[] = [];
  for (const document of documents) {
    if (document.errors.length > 0) {
      results.push({ error: document.errors[0] });
      continue;
    }
    const value = document.toJS();
    if (value === null) {
      continue;
    }
    results.push(toNamedConfig(value));
  }
  return results;
}

function toNamedConfig(value: unknown): DocumentResult {
  try {
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new Error("config document is not an object");
    }
    const record = value as Record<string, unknown>;
    const name = record.name;
    if (typeof name !== "string" || name.length === 0) {
      throw new Error("config document has no valid name");
    }
    const config = record.config === undefined || record.config === null ? {} : record.config;
    assertJsonCompatible(config, "config");
    return { name, config };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }
}

function assertJsonCompatible(value: unknown, where: string): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${where} contains a non-finite number`);
    }
    return;
  }
  if (typeof value !== "object") {
    throw new Error(`${where} contains a value of unsupported type: ${typeof value}`);
  }
  if (
    value instanceof Date ||
    Buffer.isBuffer(value) ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set
  ) {
    throw new Error(`${where} contains a non-JSON value: ${value.constructor.name}`);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      assertJsonCompatible(item, where);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (child === undefined) {
      throw new Error(`${where}.${key} is undefined, which is not a JSON value`);
    }
    assertJsonCompatible(child, `${where}.${key}`);
  }
}

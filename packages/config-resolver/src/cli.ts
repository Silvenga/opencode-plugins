export { parseDocumentResults, type DocumentResult, type NamedConfig } from "./documents.js";
export { resolvePath, type PathTarget } from "./paths.js";
export { nodeFetcher, type Fetcher } from "./runtime.js";
export type { ReferenceProvider } from "./references/scanner.js";
export { resolveReferences } from "./references/scanner.js";
export { makeFileProvider } from "./references/providers/file.js";

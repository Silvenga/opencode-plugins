import {
  parseDocumentResults,
  resolveReferences,
  type ReferenceProvider,
} from "@slvnco-opencode/config-resolver/cli";
import { findSchema } from "../../schema-registry.js";
import { makeReferenceProviders, toLocalTarget, type RuntimeDeps } from "./runtime.js";

export type OnLine = (line: string) => void;

export async function validateFile(
  path: string,
  deps: RuntimeDeps,
  onLine: OnLine,
): Promise<number> {
  const target = toLocalTarget(path);
  const yaml = await deps.fetcher.fetch(target, AbortSignal.timeout(5000));
  const base = { kind: "local" as const, path: target.path };
  const providers = makeReferenceProviders(deps);

  let failed = false;
  const documents = parseDocumentResults(yaml);
  for (const document of documents) {
    const outcome = await validateDocument(document, providers, base);
    if (outcome.status === "FAILED") {
      failed = true;
      onLine(`FAILED: ${outcome.name}: ${outcome.error}`);
    } else {
      onLine(`PASS: ${outcome.name}`);
    }
  }
  return failed ? 1 : 0;
}

async function validateDocument(
  document: { name?: string; config?: unknown; error?: Error },
  providers: Record<string, ReferenceProvider>,
  base: { kind: "local"; path: string },
): Promise<{ status: "PASS" | "FAILED"; name: string; error?: string }> {
  if (document.error !== undefined) {
    return { status: "FAILED", name: "<unknown>", error: message(document.error) };
  }
  const name = document.name ?? "<unknown>";
  const schema = findSchema(name);
  if (schema === undefined) {
    return { status: "FAILED", name, error: "unknown plugin name" };
  }
  let resolved: unknown;
  try {
    resolved = await resolveReferences(document.config, providers, base);
  } catch (error) {
    return { status: "FAILED", name, error: messageOf(error) };
  }
  const parsed = schema.safeParse(resolved);
  if (!parsed.success) {
    return { status: "FAILED", name, error: formatIssues(parsed.error.issues) };
  }
  return { status: "PASS", name };
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return String(error);
}

function message(error: Error): string {
  return error.message.length === 0 ? String(error) : error.message;
}

function formatIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; code: string; message?: string }>,
): string {
  const listed = issues
    .slice(0, 5)
    .map(
      (issue) =>
        `${issue.path.length === 0 ? "(root)" : issue.path.join(".")}: ${issue.message ?? issue.code}`,
    );
  return `invalid configuration: ${listed.join("; ")}`;
}

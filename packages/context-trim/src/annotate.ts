export interface RequestMessage {
  readonly content?: readonly unknown[];
}

export function annotateCallIDs(messages: readonly RequestMessage[]): void {
  try {
    for (const message of messages) {
      const content = message?.content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const part of content) {
        annotatePart(part);
      }
    }
  } catch {
    // Fail open: remaining results are sent unannotated.
  }
}

function annotatePart(part: unknown): void {
  if (typeof part !== "object" || part == null) {
    return;
  }
  const candidate = part as { type?: unknown; id?: unknown; result?: unknown };
  if (
    candidate.type !== "tool-result" ||
    typeof candidate.id !== "string" ||
    candidate.id.length === 0
  ) {
    return;
  }
  const result = candidate.result as { type?: unknown; value?: unknown } | null;
  if (result == null || result.type !== "text" || typeof result.value !== "string") {
    return;
  }
  result.value =
    result.value.length === 0 ? `[call ${candidate.id}]` : `[call ${candidate.id}] ${result.value}`;
}

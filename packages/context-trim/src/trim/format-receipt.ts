import type { Outcome, Parts, TrimmedOutcome } from "./adjudicate.js";
import { defaultReason } from "./stub.js";

export interface ReceiptStats {
  readonly messageCount: number;
  readonly oldestMessageIndex?: number;
  readonly tailTokens?: number;
}

export function formatReceipt(outcomes: readonly Outcome[], stats: ReceiptStats): string {
  const trimmed = outcomes.filter(
    (outcome): outcome is TrimmedOutcome => outcome.status === "trimmed",
  );
  const lines: string[] = [];
  const reclaimed = trimmed.reduce((total, outcome) => total + outcome.estimatedTokens, 0);
  lines.push(`trimmed ${trimmed.length} targets, ~${reclaimed} tokens reclaimed`);
  for (const outcome of trimmed) {
    lines.push(
      `- ${outcome.id} ${outcome.tool}: ${partsLabel(outcome.parts)} ~${outcome.estimatedTokens} tokens -> "${outcome.reason ?? defaultReason()}" (restorable with context.restore)`,
    );
  }
  for (const outcome of outcomes) {
    if (outcome.status === "skipped") {
      lines.push(`skipped ${outcome.id}: ${outcome.reason}`);
    }
  }
  for (const outcome of trimmed) {
    if (outcome.warning !== undefined) {
      lines.push(`warning ${outcome.id}: ${outcome.warning} - trimmed anyway`);
    }
  }
  if (stats.oldestMessageIndex !== undefined && stats.tailTokens !== undefined) {
    lines.push(
      `cache: oldest edit at message ${stats.oldestMessageIndex + 1} of ${stats.messageCount}, ~${stats.tailTokens} tokens re-prefill once`,
    );
  }
  return lines.join("\n");
}

function partsLabel(parts: Parts): string {
  if (parts === "both") {
    return "input+output";
  }
  return parts;
}

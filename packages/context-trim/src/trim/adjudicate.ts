import { estimateTokens } from "./estimate.js";
import type { SessionView } from "./session-view.js";
import { inputStub, outputStub, signatureOf } from "./stub.js";

export const PARTS = ["output", "input", "both"] as const;
export type Parts = (typeof PARTS)[number];

export interface Target {
  readonly id: string;
  readonly parts: Parts;
  readonly reason?: string;
}

export interface TrimmedOutcome {
  readonly status: "trimmed";
  readonly id: string;
  readonly tool: string;
  readonly primaryArgument: string;
  readonly parts: Parts;
  readonly reason?: string;
  readonly estimatedTokens: number;
  readonly warning?: string;
  readonly outputStub?: string;
  readonly inputStub?: { readonly _trimmed: string };
  readonly messageIndex: number;
}

export interface SkippedOutcome {
  readonly status: "skipped";
  readonly id: string;
  readonly reason: "not found" | "already trimmed" | "too small";
}

export type Outcome = TrimmedOutcome | SkippedOutcome;

export function adjudicate(
  targets: readonly Target[],
  deps: { view: SessionView; hasDirective: (id: string) => boolean; minTokens: number },
): Outcome[] {
  return targets.map((target) => adjudicateTarget(target, deps));
}

function adjudicateTarget(
  target: Target,
  deps: { view: SessionView; hasDirective: (id: string) => boolean; minTokens: number },
): Outcome {
  const call = deps.view.resolve(target.id);
  if (call == null) {
    return { status: "skipped", id: target.id, reason: "not found" };
  }
  if (deps.hasDirective(target.id)) {
    return { status: "skipped", id: target.id, reason: "already trimmed" };
  }

  const outputChars = target.parts === "input" ? 0 : call.outputChars;
  const inputChars = target.parts === "output" ? 0 : call.inputChars;
  const estimatedTokens = estimateTokens(outputChars + inputChars);
  if (estimatedTokens < deps.minTokens) {
    return { status: "skipped", id: target.id, reason: "too small" };
  }
  const reason =
    target.reason != null && target.reason.trim().length > 0 ? target.reason : undefined;

  const stubCall = {
    tool: call.tool,
    signature: signatureOf(call.primaryArgument),
    tokens: estimatedTokens,
    callID: call.callID,
  };
  return {
    status: "trimmed",
    id: target.id,
    tool: call.tool,
    primaryArgument: call.primaryArgument,
    parts: target.parts,
    reason,
    estimatedTokens,
    warning: call.isLatestForArgument
      ? `latest ${call.tool} of ${call.primaryArgument}`
      : undefined,
    outputStub: target.parts === "input" ? undefined : outputStub(stubCall, reason),
    inputStub: target.parts === "output" ? undefined : inputStub(stubCall, reason),
    messageIndex: call.messageIndex,
  };
}

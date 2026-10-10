import type { Directive, DirectiveStore } from "../store/directive-store.js";
import {
  adjudicate,
  isParts,
  type Outcome,
  type Target,
  type TrimmedOutcome,
} from "../trim/adjudicate.js";
import { formatReceipt, type ReceiptStats } from "../trim/format-receipt.js";
import { scrub } from "../trim/scrub.js";
import type { SessionView } from "../trim/session-view.js";

export function forgetTool(deps: {
  readonly store: DirectiveStore;
  readonly readView: (sessionID: string) => Promise<SessionView>;
  readonly minTokens: number;
}) {
  return {
    name: "forget",
    description:
      "Replace spent tool call content with short stubs to reclaim context. Copy each target id from the tool call block of the assistant turn that made the call. parts selects what is replaced: output, input, or both. reason is the short note kept in place of the content; write one a future turn can act on. Batch several targets into one call, preferring end-of-subtask checkpoints. Only trim calls whose result you have already seen.",
    input: {
      type: "object",
      properties: {
        targets: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Tool call ID copied from the tool call block" },
              parts: {
                type: "string",
                enum: ["output", "input", "both"],
                description: "What to replace",
              },
              reason: { type: "string", description: "Short note kept in place of the content" },
            },
            required: ["id", "parts"],
            additionalProperties: false,
          },
        },
      },
      required: ["targets"],
      additionalProperties: false,
    },
    options: { namespace: "context" },
    execute: async (
      rawInput: unknown,
      context: { sessionID: string },
    ): Promise<{ content: string }> => {
      const targets = readTargets(rawInput);
      const sessionID = context.sessionID;
      const [view, existing] = await Promise.all([
        deps.readView(sessionID),
        deps.store.list(sessionID),
      ]);
      const outcomes: Outcome[] = [];
      const knownCallIDs = new Set(existing.map((directive) => scrub(directive.callID)));
      for (const target of targets) {
        const [outcome] = adjudicate([target], {
          view,
          hasDirective: (id) => knownCallIDs.has(scrub(id)),
          minTokens: deps.minTokens,
        });
        if (outcome == null) {
          continue;
        }
        outcomes.push(outcome);
        if (outcome.status === "trimmed") {
          knownCallIDs.add(scrub(outcome.id));
        }
      }
      const trimmed = outcomes.filter(
        (outcome): outcome is TrimmedOutcome => outcome.status === "trimmed",
      );
      await Promise.all(
        trimmed.map((outcome) => deps.store.record(sessionID, directiveOf(outcome))),
      );
      return { content: formatReceipt(outcomes, statsOf(outcomes, view)) };
    },
  };
}

function readTargets(rawInput: unknown): Target[] {
  if (
    typeof rawInput !== "object" ||
    rawInput == null ||
    !Array.isArray((rawInput as { targets?: unknown }).targets)
  ) {
    throw new Error("context.forget: targets must be a non-empty array");
  }
  const rawTargets = (rawInput as { targets: unknown[] }).targets;
  if (rawTargets.length === 0) {
    throw new Error("context.forget: targets must be a non-empty array");
  }
  return rawTargets.map((raw, index) => {
    if (typeof raw !== "object" || raw == null) {
      throw new Error(`context.forget: targets[${index}] must be an object`);
    }
    const candidate = raw as { id?: unknown; parts?: unknown; reason?: unknown };
    if (typeof candidate.id !== "string" || candidate.id.length === 0) {
      throw new Error(`context.forget: targets[${index}].id must be a non-empty string`);
    }
    if (!isParts(candidate.parts)) {
      throw new Error(`context.forget: targets[${index}].parts must be one of output, input, both`);
    }
    const reason =
      typeof candidate.reason === "string" && candidate.reason.trim().length > 0
        ? candidate.reason
        : undefined;
    return reason == null
      ? { id: candidate.id, parts: candidate.parts }
      : { id: candidate.id, parts: candidate.parts, reason };
  });
}

function directiveOf(outcome: TrimmedOutcome): Directive {
  return {
    callID: outcome.id,
    tool: outcome.tool,
    primaryArgument: outcome.primaryArgument,
    parts: outcome.parts,
    reason: outcome.reason,
    estimatedTokens: outcome.estimatedTokens,
    outputStub: outcome.outputStub,
    inputStub: outcome.inputStub,
  };
}

function statsOf(outcomes: readonly Outcome[], view: SessionView): ReceiptStats {
  const trimmed = outcomes.filter(
    (outcome): outcome is TrimmedOutcome => outcome.status === "trimmed",
  );
  if (trimmed.length === 0) {
    return { messageCount: view.count };
  }
  const oldest = Math.min(...trimmed.map((outcome) => outcome.messageIndex));
  return {
    messageCount: view.count,
    oldestMessageIndex: oldest,
    tailTokens: view.tailTokens(oldest),
  };
}

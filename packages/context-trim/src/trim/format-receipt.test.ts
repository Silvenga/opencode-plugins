import { describe, expect, test } from "vitest";
import type { Outcome } from "./adjudicate.js";
import { formatReceipt } from "./format-receipt.js";

describe("formatReceipt", () => {
  test("When outcomes contain trims then formatReceipt should render totals and per-target lines", () => {
    const outcomes: Outcome[] = [
      {
        status: "trimmed",
        id: "call_abc",
        tool: "bash",
        primaryArgument: "npm test",
        parts: "output",
        reason: "spent build log, tests passed",
        estimatedTokens: 8432,
        messageIndex: 41,
      },
      {
        status: "trimmed",
        id: "call_def",
        tool: "read",
        primaryArgument: "/src/foo.ts",
        parts: "both",
        estimatedTokens: 5778,
        messageIndex: 42,
      },
    ];

    const receipt = formatReceipt(outcomes, {
      messageCount: 88,
      oldestMessageIndex: 41,
      tailTokens: 46000,
    });

    expect(receipt.split("\n")).toEqual([
      "trimmed 2 targets, ~14210 tokens reclaimed",
      '- call_abc bash: output ~8432 tokens -> "spent build log, tests passed" (restorable with context.restore)',
      '- call_def read: input+output ~5778 tokens -> "original restorable with context.restore" (restorable with context.restore)',
      "cache: oldest edit at message 42 of 88, ~46000 tokens re-prefill once",
    ]);
  });

  test("When outcomes contain skips and warnings then formatReceipt should render their lines", () => {
    const outcomes: Outcome[] = [
      {
        status: "trimmed",
        id: "call_jkl",
        tool: "read",
        primaryArgument: "/src/foo.ts",
        parts: "output",
        estimatedTokens: 1990,
        warning: "latest read of /src/foo.ts",
        messageIndex: 10,
      },
      { status: "skipped", id: "call_ghi", reason: "not found" },
    ];

    const receipt = formatReceipt(outcomes, {
      messageCount: 50,
      oldestMessageIndex: 10,
      tailTokens: 3000,
    });

    expect(receipt.split("\n")).toEqual([
      "trimmed 1 targets, ~1990 tokens reclaimed",
      '- call_jkl read: output ~1990 tokens -> "original restorable with context.restore" (restorable with context.restore)',
      "skipped call_ghi: not found",
      "warning call_jkl: latest read of /src/foo.ts - trimmed anyway",
      "cache: oldest edit at message 11 of 50, ~3000 tokens re-prefill once",
    ]);
  });

  test("When nothing was trimmed then formatReceipt should omit the cache line", () => {
    const outcomes: Outcome[] = [{ status: "skipped", id: "call_ghi", reason: "not found" }];

    const receipt = formatReceipt(outcomes, { messageCount: 50 });

    expect(receipt.split("\n")).toEqual([
      "trimmed 0 targets, ~0 tokens reclaimed",
      "skipped call_ghi: not found",
    ]);
  });
});

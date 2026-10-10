import { describe, expect, test } from "vitest";
import { adjudicate } from "./adjudicate.js";
import { assistantToolMessage, userMessage } from "./fixtures.js";
import { SessionView } from "./session-view.js";

const bigOutput = "x".repeat(4000);

function makeView() {
  return new SessionView([
    userMessage("start"),
    assistantToolMessage({
      id: "call_old",
      name: "read",
      input: { path: "/a.ts" },
      output: bigOutput,
    }),
    assistantToolMessage({
      id: "call_new",
      name: "read",
      input: { path: "/a.ts" },
      output: bigOutput,
    }),
    assistantToolMessage({
      id: "call_bash",
      name: "bash",
      input: { command: "npm test" },
      output: bigOutput,
    }),
  ]);
}

describe("adjudicate", () => {
  test("When the target is missing from the view then adjudicate should skip with not found", () => {
    const outcome = adjudicate([{ id: "call_missing", parts: "output" }], {
      view: makeView(),
      hasDirective: () => false,
      minTokens: 400,
    });

    expect(outcome).toEqual([{ status: "skipped", id: "call_missing", reason: "not found" }]);
  });

  test("When the target already has a directive then adjudicate should skip with already trimmed", () => {
    const outcome = adjudicate([{ id: "call_old", parts: "output" }], {
      view: makeView(),
      hasDirective: (id) => id === "call_old",
      minTokens: 400,
    });

    expect(outcome).toEqual([{ status: "skipped", id: "call_old", reason: "already trimmed" }]);
  });

  test("When the estimate is below minTokens then adjudicate should skip with too small", () => {
    const view = new SessionView([
      assistantToolMessage({
        id: "call_small",
        name: "read",
        input: { path: "/a.ts" },
        output: "tiny",
      }),
    ]);

    const outcome = adjudicate([{ id: "call_small", parts: "output" }], {
      view,
      hasDirective: () => false,
      minTokens: 400,
    });

    expect(outcome).toEqual([{ status: "skipped", id: "call_small", reason: "too small" }]);
  });

  test("When the target is the latest read then adjudicate should trim with warning", () => {
    const outcome = adjudicate([{ id: "call_new", parts: "output" }], {
      view: makeView(),
      hasDirective: () => false,
      minTokens: 400,
    });

    expect(outcome[0]?.status).toBe("trimmed");
    expect(outcome[0]).toMatchObject({
      status: "trimmed",
      warning: "latest read of /a.ts",
    });
  });

  test("When the target is superseded then adjudicate should trim without warning", () => {
    const outcome = adjudicate([{ id: "call_old", parts: "output" }], {
      view: makeView(),
      hasDirective: () => false,
      minTokens: 400,
    });

    expect(outcome[0]).toMatchObject({ status: "trimmed", warning: undefined });
  });

  test("When trimming then adjudicate should compute stubs and the estimate", () => {
    const outcome = adjudicate([{ id: "call_bash", parts: "both", reason: "spent log" }], {
      view: makeView(),
      hasDirective: () => false,
      minTokens: 400,
    });

    const expectedTokens = Math.ceil(
      (JSON.stringify([{ type: "text", text: bigOutput }]).length +
        JSON.stringify({ command: "npm test" }).length) /
        4,
    );
    expect(outcome[0]).toMatchObject({
      status: "trimmed",
      tool: "bash",
      estimatedTokens: expectedTokens,
      reason: "spent log",
      messageIndex: 3,
    });
    const trimmed = outcome[0];
    if (trimmed?.status !== "trimmed") {
      throw new Error("expected trimmed outcome");
    }
    expect(trimmed.outputStub).toContain("spent log");
    expect(trimmed.inputStub?._trimmed).toContain("spent log");
  });

  test("When parts is output then adjudicate should not produce an input stub", () => {
    const outcome = adjudicate([{ id: "call_bash", parts: "output" }], {
      view: makeView(),
      hasDirective: () => false,
      minTokens: 400,
    });

    expect(outcome[0]?.status).toBe("trimmed");
    expect((outcome[0] as { inputStub?: unknown }).inputStub).toBeUndefined();
    expect((outcome[0] as { outputStub?: unknown }).outputStub).toBeDefined();
  });
});

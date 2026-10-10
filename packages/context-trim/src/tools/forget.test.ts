import { describe, expect, test } from "vitest";
import { DirectiveStore, type StorageLike } from "../store/directive-store.js";
import { assistantToolMessage, userMessage } from "../trim/fixtures.js";
import { SessionView } from "../trim/session-view.js";
import { forgetTool } from "./forget.js";

const bigOutput = "x".repeat(4000);

function makeStorage(): StorageLike & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value);
    },
    remove: async (key) => {
      map.delete(key);
    },
    scan: async (prefix) =>
      [...map.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({ key, value })),
  };
}

function makeDeps() {
  const storage = makeStorage();
  const view = new SessionView([
    userMessage("start"),
    assistantToolMessage({
      id: "call_1",
      name: "bash",
      input: { command: "npm test" },
      output: bigOutput,
    }),
    assistantToolMessage({
      id: "call_2",
      name: "read",
      input: { path: "/a.ts" },
      output: bigOutput,
    }),
  ]);
  return {
    storage,
    deps: {
      store: new DirectiveStore(storage),
      readView: async () => view,
      minTokens: 400,
    },
  };
}

describe("forgetTool", () => {
  test("When targets pass the rules then execute should record directives and return the receipt", async () => {
    const { deps, storage } = makeDeps();
    const tool = forgetTool(deps);

    const result = await tool.execute(
      { targets: [{ id: "call_2", parts: "output", reason: "old read, superseded" }] },
      { sessionID: "ses_1" },
    );

    expect(result.content).toContain("trimmed 1 targets");
    expect(result.content).toContain("call_2 read: output");
    expect(result.content).toContain("old read, superseded");
    expect(result.content).toContain("cache: oldest edit at message 3 of 3");
    expect(storage.map.has("directives/ses_1/call_2")).toBe(true);
  });

  test("When the view read fails then execute should reject and record nothing", async () => {
    const storage = makeStorage();
    const tool = forgetTool({
      store: new DirectiveStore(storage),
      readView: async () => {
        throw new Error("context unavailable");
      },
      minTokens: 400,
    });

    await expect(
      tool.execute({ targets: [{ id: "call_1", parts: "output" }] }, { sessionID: "ses_1" }),
    ).rejects.toThrow("context unavailable");
    expect(storage.map.size).toBe(0);
  });

  test("When all targets are skipped then execute should record nothing", async () => {
    const { deps, storage } = makeDeps();
    const tool = forgetTool(deps);

    const result = await tool.execute(
      { targets: [{ id: "call_missing", parts: "output" }] },
      { sessionID: "ses_1" },
    );

    expect(result.content).toContain("skipped call_missing: not found");
    expect(storage.map.size).toBe(0);
  });

  test("When targets is empty then execute should reject", async () => {
    const { deps } = makeDeps();
    const tool = forgetTool(deps);

    await expect(tool.execute({ targets: [] }, { sessionID: "ses_1" })).rejects.toThrow(
      "non-empty",
    );
  });

  test("When a batch repeats a call id then the second target should report already trimmed", async () => {
    const { deps, storage } = makeDeps();
    const tool = forgetTool(deps);

    const result = await tool.execute(
      {
        targets: [
          { id: "call_2", parts: "output" },
          { id: "call_2", parts: "input" },
        ],
      },
      { sessionID: "ses_1" },
    );

    expect(result.content).toContain("trimmed 1 targets");
    expect(result.content).toContain("skipped call_2: already trimmed");
    expect([...storage.map.keys()].filter((key) => key.startsWith("directives/"))).toHaveLength(1);
  });

  test("When a target entry is malformed then execute should reject with its index", async () => {
    const { deps } = makeDeps();
    const tool = forgetTool(deps);

    await expect(
      tool.execute(
        {
          targets: [
            { id: "call_2", parts: "output" },
            { id: "", parts: "output" },
          ],
        },
        { sessionID: "ses_1" },
      ),
    ).rejects.toThrow("targets[1].id");
  });

  test("When the reason is blank then the stub should use the default recovery text", async () => {
    const { deps, storage } = makeDeps();
    const tool = forgetTool(deps);

    const result = await tool.execute(
      { targets: [{ id: "call_2", parts: "output", reason: "   " }] },
      { sessionID: "ses_1" },
    );

    expect(result.content).toContain("original restorable with context.restore");
    const directive = [...storage.map.values()][0] as { outputStub?: string };
    expect(directive.outputStub).toContain("original restorable with context.restore");
  });
});

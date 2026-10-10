import { describe, expect, test } from "vitest";
import { ContextPatcher } from "./context-patcher.js";
import { DirectiveStore, type Directive, type StorageLike } from "./store/directive-store.js";
import { requestTurn } from "./trim/fixtures.js";

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

function partOf(
  messages: readonly unknown[],
  messageIndex: number,
  partIndex: number,
): Record<string, unknown> {
  const message = messages[messageIndex] as { content?: readonly unknown[] };
  const part = message.content?.[partIndex];
  if (part == null) {
    throw new Error("missing part");
  }
  return part as Record<string, unknown>;
}

function outputDirective(callID: string): Directive {
  return {
    callID,
    tool: "bash",
    primaryArgument: "npm test",
    parts: "output",
    estimatedTokens: 5000,
    outputStub: "[trimmed: bash npm test, ~5000 tokens, call " + callID + "]. spent log.",
  };
}

function inputDirective(callID: string): Directive {
  return {
    callID,
    tool: "bash",
    primaryArgument: "deploy.sh",
    parts: "both",
    estimatedTokens: 5000,
    outputStub: "[trimmed output]",
    inputStub: { _trimmed: "bash deploy.sh, ~5000 tokens. spent script" },
  };
}

describe("ContextPatcher", () => {
  test("When a directive covers output then patch should replace the tool result with the stub text", async () => {
    const storage = makeStorage();
    const store = new DirectiveStore(storage);
    await store.record("ses_1", outputDirective("call_1"));
    const messages = requestTurn({ callID: "call_1", tool: "bash", result: "full test output" });
    const patcher = new ContextPatcher(store);

    await patcher.patch("ses_1", messages);

    const result = partOf(messages, 1, 0).result;
    expect(result).toEqual({
      type: "text",
      value: "[trimmed: bash npm test, ~5000 tokens, call call_1]. spent log.",
    });
  });

  test("When a directive covers input then patch should replace the tool call input with the stub object", async () => {
    const storage = makeStorage();
    const store = new DirectiveStore(storage);
    await store.record("ses_1", inputDirective("call_1"));
    const messages = requestTurn({
      callID: "call_1",
      tool: "bash",
      input: { command: "bash deploy.sh" },
      result: "ok",
    });
    const patcher = new ContextPatcher(store);

    await patcher.patch("ses_1", messages);

    const input = partOf(messages, 0, 1).input;
    expect(input).toEqual({ _trimmed: "bash deploy.sh, ~5000 tokens. spent script" });
  });

  test("When patching then ids and names should remain unchanged", async () => {
    const storage = makeStorage();
    const store = new DirectiveStore(storage);
    await store.record("ses_1", inputDirective("call_1"));
    const messages = requestTurn({
      callID: "call_1",
      tool: "bash",
      input: { command: "x" },
      result: "ok",
    });
    const patcher = new ContextPatcher(store);

    await patcher.patch("ses_1", messages);

    expect(partOf(messages, 0, 1).id).toBe("call_1");
    expect(partOf(messages, 0, 1).name).toBe("bash");
    expect(partOf(messages, 1, 0).id).toBe("call_1");
    const callContent = (messages[0] as { content: readonly unknown[] }).content;
    const resultContent = (messages[1] as { content: readonly unknown[] }).content;
    expect(callContent).toHaveLength(2);
    expect(resultContent).toHaveLength(1);
  });

  test("When the target is absent from messages then patch should prune the directive", async () => {
    const storage = makeStorage();
    const store = new DirectiveStore(storage);
    await store.record("ses_1", outputDirective("call_1"));
    await store.record("ses_1", outputDirective("call_2"));
    const messages = requestTurn({ callID: "call_2", tool: "bash", result: "ok" });
    const patcher = new ContextPatcher(store);

    await patcher.patch("ses_1", messages);

    expect(await store.has("ses_1", "call_2")).toBe(true);
    expect(await store.has("ses_1", "call_1")).toBe(false);
  });

  test("When patching throws mid-walk then it should send messages unmodified without rethrowing", async () => {
    const failing = {
      list: () => Promise.reject(new Error("storage down")),
      remove: () => Promise.resolve(),
      has: () => Promise.resolve(false),
      record: () => Promise.resolve(),
      removeAll: () => Promise.resolve(),
    } as unknown as DirectiveStore;
    const messages = requestTurn({ callID: "call_1", tool: "bash", result: "full output" });
    const patcher = new ContextPatcher(failing);

    await expect(patcher.patch("ses_1", messages)).resolves.toBeUndefined();

    const result = partOf(messages, 1, 0).result;
    expect(result).toEqual({ type: "text", value: "full output" });
  });

  test("When patched twice with the same inputs then the walk should be byte-stable", async () => {
    const storage = makeStorage();
    const store = new DirectiveStore(storage);
    await store.record("ses_1", inputDirective("call_1"));
    const patcher = new ContextPatcher(store);
    const first = requestTurn({
      callID: "call_1",
      tool: "bash",
      input: { command: "x" },
      result: "ok",
    });
    const second = requestTurn({
      callID: "call_1",
      tool: "bash",
      input: { command: "x" },
      result: "ok",
    });

    await patcher.patch("ses_1", first);
    await patcher.patch("ses_1", second);

    expect(JSON.stringify(second)).toEqual(JSON.stringify(first));
  });
});

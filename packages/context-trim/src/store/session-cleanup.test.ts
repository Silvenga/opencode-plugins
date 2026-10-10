import { describe, expect, test } from "vitest";
import { DirectiveStore, type Directive } from "./directive-store.js";
import { SessionCleanup } from "./session-cleanup.js";

function makeStore() {
  const removed: string[] = [];
  const directive: Directive = {
    callID: "call_1",
    tool: "read",
    primaryArgument: "/a.ts",
    parts: "output",
    estimatedTokens: 5000,
    outputStub: "[trimmed]",
  };
  return {
    removed,
    store: {
      removeAll: async (sessionID: string) => {
        removed.push(sessionID);
      },
    } as unknown as DirectiveStore,
    directive,
  };
}

async function* events(signal: AbortSignal, events: unknown[]) {
  if (signal.aborted) {
    return;
  }
  for (const event of events) {
    if (signal.aborted) {
      return;
    }
    yield event as never;
  }
}

describe("SessionCleanup", () => {
  test("When session.deleted arrives then cleanup should remove that session's directives", async () => {
    const harness = makeStore();
    const cleanup = new SessionCleanup(harness.store, (signal) =>
      events(signal, [
        { type: "session.updated", data: { sessionID: "ses_1" } },
        { type: "session.deleted", data: { sessionID: "ses_1" } },
      ]),
    );
    const controller = new AbortController();

    cleanup.start(controller.signal);
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();

    expect(harness.removed).toEqual(["ses_1"]);
  });

  test("When session.deleted has no sessionID then cleanup should skip it", async () => {
    const harness = makeStore();
    const cleanup = new SessionCleanup(harness.store, (signal) =>
      events(signal, [{ type: "session.deleted", data: {} }]),
    );
    const controller = new AbortController();

    cleanup.start(controller.signal);
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();

    expect(harness.removed).toEqual([]);
  });

  test("When removal throws then cleanup should keep consuming", async () => {
    const calls: string[] = [];
    const failingThenWorking = {
      removeAll: async (sessionID: string) => {
        calls.push(sessionID);
        if (calls.length === 1) {
          throw new Error("storage down");
        }
      },
    } as unknown as DirectiveStore;
    const cleanup = new SessionCleanup(failingThenWorking, (signal) =>
      events(signal, [
        { type: "session.deleted", data: { sessionID: "ses_1" } },
        { type: "session.deleted", data: { sessionID: "ses_2" } },
      ]),
    );
    const controller = new AbortController();

    cleanup.start(controller.signal);
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();

    expect(calls).toEqual(["ses_1", "ses_2"]);
  });

  test("When the subscription throws then cleanup should retry and keep processing", async () => {
    const removed: string[] = [];
    const store = {
      removeAll: async (sessionID: string) => {
        removed.push(sessionID);
      },
    } as unknown as DirectiveStore;
    let calls = 0;
    const cleanup = new SessionCleanup(store, (signal) => {
      calls++;
      if (calls === 1) {
        return {
          [Symbol.asyncIterator]() {
            return {
              next: async () => {
                throw new Error("bus disconnected");
              },
            };
          },
        };
      }
      if (calls > 2) {
        return {
          [Symbol.asyncIterator]() {
            return { next: async () => ({ done: true, value: undefined }) };
          },
        };
      }
      return events(signal, [{ type: "session.deleted", data: { sessionID: "ses_1" } }]);
    });
    const controller = new AbortController();

    cleanup.start(controller.signal);
    await new Promise((resolve) => setTimeout(resolve, 2100));
    controller.abort();

    expect(removed).toEqual(["ses_1"]);
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});

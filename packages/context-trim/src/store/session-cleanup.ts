import type { DirectiveStore } from "./directive-store.js";

export interface EncodedEvent {
  readonly type: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

export class SessionCleanup {
  private readonly store: DirectiveStore;
  private readonly subscribe: (signal: AbortSignal) => AsyncIterable<EncodedEvent>;

  constructor(
    store: DirectiveStore,
    subscribe: (signal: AbortSignal) => AsyncIterable<EncodedEvent>,
  ) {
    this.store = store;
    this.subscribe = subscribe;
  }

  start(signal: AbortSignal): void {
    void this.run(signal);
  }

  private async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      try {
        await this.loop(signal);
      } catch {
        // The subscription failed; retry after a pause unless aborted.
      }
      if (!signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  private async loop(signal: AbortSignal): Promise<void> {
    for await (const event of this.subscribe(signal)) {
      if (event.type !== "session.deleted") {
        continue;
      }
      const sessionID = readSessionID(event);
      if (sessionID === undefined) {
        continue;
      }
      try {
        await this.store.removeAll(sessionID);
      } catch {
        // Keys remain; retried on the next session.deleted.
      }
    }
  }
}

function readSessionID(event: EncodedEvent): string | undefined {
  const value = event.data?.sessionID;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

import type { StorageLike } from "./store/directive-store.js";
import type { EncodedEvent } from "./store/session-cleanup.js";
import { SessionView, type ViewMessage } from "./trim/session-view.js";

interface HostContext {
  readonly storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    remove(key: string): Promise<void>;
    scan(options: { prefix: string; after?: string; limit?: number }): Promise<{
      entries: readonly { key: string; value: unknown }[];
      next?: string;
    }>;
  };
  readonly session: {
    context(input: { sessionID: string }): Promise<readonly ViewMessage[]>;
  };
  readonly event: {
    subscribe(options?: { signal?: AbortSignal }): AsyncIterable<EncodedEvent>;
  };
}

export class Runtime {
  private readonly ctx: HostContext;

  private constructor(ctx: HostContext) {
    this.ctx = ctx;
  }

  static fromContext(ctx: HostContext): Runtime {
    return new Runtime(ctx);
  }

  get storage(): StorageLike {
    return {
      get: (key) => this.ctx.storage.get(key),
      set: (key, value) => this.ctx.storage.set(key, value),
      remove: (key) => this.ctx.storage.remove(key),
      scan: async (prefix) => {
        const entries: { key: string; value: unknown }[] = [];
        let after: string | undefined = undefined;
        for (;;) {
          const page = await this.ctx.storage.scan({ prefix, after, limit: 100 });
          entries.push(...page.entries);
          const next = page.next;
          if (!next || next === after) {
            return entries;
          }
          after = next;
        }
      },
    };
  }

  readonly readView = async (sessionID: string): Promise<SessionView> => {
    const messages = await this.ctx.session.context({ sessionID });
    return new SessionView(messages);
  };

  readonly events = (signal: AbortSignal): AsyncIterable<EncodedEvent> =>
    this.ctx.event.subscribe({ signal });
}

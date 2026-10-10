import type { Directive, DirectiveStore } from "./store/directive-store.js";
import { scrub } from "./trim/scrub.js";

export interface RequestMessage {
  readonly role: string;
  readonly content?: readonly unknown[];
}

export class Applier {
  private readonly store: DirectiveStore;

  constructor(store: DirectiveStore) {
    this.store = store;
  }

  async apply(sessionID: string, messages: readonly RequestMessage[]): Promise<void> {
    try {
      const directives = await this.store.list(sessionID);
      const byCallID = new Map(
        directives.map((directive) => [scrub(directive.callID), directive] as const),
      );
      const seen = new Set<string>();
      for (const message of messages) {
        const content = message.content;
        if (!Array.isArray(content)) {
          continue;
        }
        for (const part of content) {
          if (typeof part !== "object" || part == null) {
            continue;
          }
          const scrubbed = scrubbedID(part);
          if (scrubbed == null) {
            continue;
          }
          const directive = byCallID.get(scrubbed);
          if (directive == null) {
            continue;
          }
          if (applyToPart(part, directive)) {
            seen.add(scrubbed);
          }
        }
      }
      const unseen = directives.filter((directive) => !seen.has(scrub(directive.callID)));
      await Promise.all(unseen.map((directive) => this.store.remove(sessionID, directive.callID)));
    } catch {
      // Fail open: the request is sent with messages unmodified.
    }
  }
}

function scrubbedID(part: object): string | undefined {
  if (!("id" in part)) {
    return undefined;
  }
  const id = part.id;
  return typeof id === "string" ? scrub(id) : undefined;
}

function applyToPart(part: object, directive: Directive): boolean {
  const mutable = part as { type?: unknown; input?: unknown; result?: unknown };
  if (mutable.type === "tool-call" && directive.inputStub != null && "input" in mutable) {
    mutable.input = directive.inputStub;
    return true;
  }
  if (mutable.type === "tool-result" && directive.outputStub != null) {
    mutable.result = { type: "text", value: directive.outputStub };
    return true;
  }
  return false;
}

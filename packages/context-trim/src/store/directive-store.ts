import { isParts, type Parts } from "../trim/adjudicate.js";
import { scrub } from "../trim/scrub.js";

export interface Directive {
  readonly callID: string;
  readonly tool: string;
  readonly primaryArgument: string;
  readonly parts: Parts;
  readonly reason?: string;
  readonly estimatedTokens: number;
  readonly outputStub?: string;
  readonly inputStub?: { readonly _trimmed: string };
}

export interface StorageLike {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  scan(prefix: string): Promise<readonly { key: string; value: unknown }[]>;
}

export class DirectiveStore {
  private readonly storage: StorageLike;

  constructor(storage: StorageLike) {
    this.storage = storage;
  }

  static scanPrefix(sessionID: string): string {
    return `directives/${scrub(sessionID)}/`;
  }

  static key(sessionID: string, callID: string): string {
    return `${DirectiveStore.scanPrefix(sessionID)}${scrub(callID)}`;
  }

  async has(sessionID: string, callID: string): Promise<boolean> {
    const value = await this.storage.get(DirectiveStore.key(sessionID, callID));
    return value != null && isDirective(value);
  }

  async record(sessionID: string, directive: Directive): Promise<void> {
    const key = DirectiveStore.key(sessionID, directive.callID);
    const existing = await this.storage.get(key);
    if (isDirective(existing)) {
      return;
    }
    await this.storage.set(key, directive);
  }

  async list(sessionID: string): Promise<Directive[]> {
    const entries = await this.storage.scan(DirectiveStore.scanPrefix(sessionID));
    const directives: Directive[] = [];
    for (const entry of entries) {
      if (isDirective(entry.value)) {
        directives.push(entry.value);
      }
    }
    return directives;
  }

  async remove(sessionID: string, callID: string): Promise<void> {
    await this.storage.remove(DirectiveStore.key(sessionID, callID));
  }

  async removeAll(sessionID: string): Promise<void> {
    const entries = await this.storage.scan(DirectiveStore.scanPrefix(sessionID));
    await Promise.all(entries.map((entry) => this.storage.remove(entry.key)));
  }
}

function isDirective(value: unknown): value is Directive {
  if (typeof value !== "object" || value == null) {
    return false;
  }
  const candidate = value as Partial<Directive>;
  return (
    typeof candidate.callID === "string" &&
    typeof candidate.tool === "string" &&
    typeof candidate.primaryArgument === "string" &&
    isParts(candidate.parts) &&
    typeof candidate.estimatedTokens === "number"
  );
}

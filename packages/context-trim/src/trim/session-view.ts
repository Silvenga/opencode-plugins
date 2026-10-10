import { estimateTokens } from "./estimate.js";
import { scrub } from "./scrub.js";

export interface ViewContent {
  readonly type: string;
  readonly text?: string;
}

export interface ViewToolState {
  readonly status: string;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly content?: readonly ViewContent[];
}

export interface ViewToolPart {
  readonly type: "tool";
  readonly id: string;
  readonly name: string;
  readonly state: ViewToolState;
}

export interface ViewMessage {
  readonly id: string;
  readonly type: string;
  readonly content?: readonly unknown[];
}

export interface ResolvedCall {
  readonly messageIndex: number;
  readonly callID: string;
  readonly tool: string;
  readonly primaryArgument: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly outputText: string;
  readonly omittedPartCount: number;
  readonly outputChars: number;
  readonly inputChars: number;
  readonly isLatestForArgument: boolean;
}

export function primaryArgumentOf(input: Readonly<Record<string, unknown>> | string): string {
  if (typeof input === "string") {
    return input.slice(0, 80);
  }
  for (const value of Object.values(input)) {
    if (typeof value === "string") {
      return value.slice(0, 80);
    }
  }
  return "";
}

export class SessionView {
  private readonly messages: readonly ViewMessage[];

  constructor(messages: readonly ViewMessage[]) {
    this.messages = messages;
  }

  get count(): number {
    return this.messages.length;
  }

  resolve(id: string): ResolvedCall | undefined {
    const target = this.findTool(id);
    if (target == null) {
      return undefined;
    }
    const { messageIndex, part } = target;
    const state = part.state;
    if (state.status !== "completed" || state.input == null || state.content == null) {
      return undefined;
    }
    const primaryArgument = primaryArgumentOf(state.input);
    const isLatestForArgument = this.isLatest(scrub(id), part.name, primaryArgument);
    const textContent = state.content.filter(
      (content): content is { type: string; text: string } =>
        content.type === "text" && typeof content.text === "string",
    );
    const outputText = textContent.map((content) => content.text).join("\n");
    return {
      messageIndex,
      callID: part.id,
      tool: part.name,
      primaryArgument,
      input: state.input,
      outputText,
      omittedPartCount: state.content.length - textContent.length,
      outputChars: JSON.stringify(state.content).length,
      inputChars: JSON.stringify(state.input).length,
      isLatestForArgument,
    };
  }

  tailTokens(fromIndex: number): number {
    let chars = 0;
    for (let index = fromIndex; index < this.messages.length; index++) {
      chars += JSON.stringify(this.messages[index]).length;
    }
    return estimateTokens(chars);
  }

  private findTool(id: string): { messageIndex: number; part: ViewToolPart } | undefined {
    const scrubbed = scrub(id);
    for (let messageIndex = 0; messageIndex < this.messages.length; messageIndex++) {
      const content = this.messages[messageIndex]?.content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const part of content) {
        const tool = asToolPart(part);
        if (tool != null && scrub(tool.id) === scrubbed) {
          return { messageIndex, part: tool };
        }
      }
    }
    return undefined;
  }

  private isLatest(scrubbedCallID: string, toolName: string, primaryArgument: string): boolean {
    let latest: string | undefined;
    for (const message of this.messages) {
      const content = message.content;
      if (!Array.isArray(content)) {
        continue;
      }
      for (const part of content) {
        const tool = asToolPart(part);
        if (tool == null || tool.state.status !== "completed") {
          continue;
        }
        const state = tool.state;
        if (state.input == null || tool.name !== toolName) {
          continue;
        }
        if (primaryArgumentOf(state.input) !== primaryArgument) {
          continue;
        }
        latest = scrub(tool.id);
      }
    }
    return latest === scrubbedCallID;
  }
}

function asToolPart(part: unknown): ViewToolPart | undefined {
  if (typeof part !== "object" || part == null) {
    return undefined;
  }
  const candidate = part as ViewToolPart;
  return candidate.type === "tool" &&
    typeof candidate.id === "string" &&
    typeof candidate.state === "object" &&
    candidate.state != null
    ? candidate
    : undefined;
}

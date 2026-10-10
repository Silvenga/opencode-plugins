export interface StubCall {
  readonly tool: string;
  readonly signature: string;
  readonly tokens: number;
  readonly callID: string;
}

export function signatureOf(primaryArgument: string): string {
  return primaryArgument.replace(/\s+/g, " ").trim().slice(0, 60);
}

export function defaultReason(): string {
  return "original restorable with context.restore";
}

export function outputStub(call: StubCall, reason?: string): string {
  return `[trimmed: ${call.tool} ${call.signature}, ~${call.tokens} tokens, call ${call.callID}]. ${reason ?? defaultReason()}.`;
}

export function inputStub(call: StubCall, reason?: string): { readonly _trimmed: string } {
  return {
    _trimmed: `${call.tool} ${call.signature}, ~${call.tokens} tokens. ${reason ?? defaultReason()}`,
  };
}

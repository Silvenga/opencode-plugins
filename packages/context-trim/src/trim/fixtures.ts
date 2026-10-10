export interface ViewToolFixture {
  readonly id: string;
  readonly name: string;
  readonly input?: Readonly<Record<string, unknown>>;
  readonly output?: string;
  readonly status?: string;
}

export function assistantToolMessage(fixture: ViewToolFixture) {
  return {
    id: `msg_${fixture.id}`,
    type: "assistant",
    content: [
      {
        type: "tool",
        id: fixture.id,
        name: fixture.name,
        state: {
          status: fixture.status ?? "completed",
          input: fixture.input ?? {},
          content: [{ type: "text", text: fixture.output ?? "tool output" }],
        },
      },
    ],
  };
}

export function userMessage(text: string) {
  return { id: `msg_${text}`, type: "user", content: [{ type: "text", text }] };
}

export interface RequestTurnFixture {
  readonly callID: string;
  readonly tool: string;
  readonly input?: unknown;
  readonly result?: string;
}

export function requestTurn(fixture: RequestTurnFixture) {
  return [
    {
      role: "assistant",
      content: [
        { type: "text", text: "calling" },
        { type: "tool-call", id: fixture.callID, name: fixture.tool, input: fixture.input ?? {} },
      ],
    },
    {
      role: "tool",
      content: [
        {
          type: "tool-result",
          id: fixture.callID,
          name: fixture.tool,
          result: { type: "text", value: fixture.result ?? "tool output" },
        },
      ],
    },
  ];
}

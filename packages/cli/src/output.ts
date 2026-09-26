export interface Output {
  readonly out: (chunk: string) => void;
  readonly err: (chunk: string) => void;
}

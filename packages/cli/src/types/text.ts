export type NumberedLine = { text: string; number: number };

export type TextPosition = { line: number; column: number };

export type SourcePosition = { start: { offset: number }; end: { offset: number } };

/** Text and its one-based source line for asset parsing and syntax diagnostics. */
export type NumberedLine = { text: string; number: number };

/** A one-based line and column within text. */
export type TextPosition = { line: number; column: number };

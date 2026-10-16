/** Text and its one-based source line for asset parsing and syntax diagnostics. */
export type NumberedLine = { text: string; number: number };

/** A one-based line and column within text. */
export type TextPosition = { line: number; column: number };

/** The offsets attached to every position in a parsed Markdown document. */
export type SourcePosition = { start: { offset: number }; end: { offset: number } };

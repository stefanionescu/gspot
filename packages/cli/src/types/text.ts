/** One line of text and its line number, counted from one. */
export type NumberedLine = { text: string; number: number };

/** A one-based line and column within text. */
export type TextPosition = { line: number; column: number };

/** The start and end offsets of a node in a parsed Markdown document. */
export type SourcePosition = { start: { offset: number }; end: { offset: number } };

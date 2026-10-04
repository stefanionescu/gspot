/** the Vale input mode, source grammar, and optional comment format for one file extension. */
export type ProseGrammar = { mode: 'path' | 'stdin'; extension: string; format?: string };

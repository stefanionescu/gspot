/** The classified version or failure of a completed version command. */
export type ParsedToolVersion = { version: string } | { state: 'missing' | 'error'; note: string };

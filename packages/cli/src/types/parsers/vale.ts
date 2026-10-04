/** A Vale diagnostic normalized to a repository path and one-based source location. */
export type ValeAlert = { file: string; line: number; column: number; check: string; message: string };

/** Assignments retained in source order for one Vale file-pattern section. */
export type ValeAssignments = Map<string, string[]>;
/** A cursor over multiline Vale configuration values. */
export type LineCursor = { lines: string[]; index: number };

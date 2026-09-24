// Type aliases of the prose engine.

/** How one file reaches Vale. */
export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };

/** One Vale alert, parsed. */
export type ValeAlert = { file: string; line: number; column: number; check: string; message: string };

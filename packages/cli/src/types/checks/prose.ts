// The types of checks/prose in this package.

/** One Vale alert, parsed. */
export type ValeAlert = { file: string; line: number; column: number; check: string; message: string };
export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };

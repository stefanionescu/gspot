export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };

export type ProseRouteBatch = [ProseRoute, ...ProseRoute[]];

export type ValeAlert = { file: string; line: number; column: number; check: string; message: string };

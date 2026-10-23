export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };

export type ProseRouteGroup = [ProseRoute, ...ProseRoute[]];

export type ValeAlert = { file: string; line: number; column: number; check: string; message: string };

export type ValeReport = Record<string, { Line: number; Span: [number, number]; Check: string; Message: string }[]>;

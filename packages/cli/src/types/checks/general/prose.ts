export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };

/** A nonempty set of path routes or one stdin route. */
export type ProseRouteGroup = [ProseRoute, ...ProseRoute[]];

export type ValeAlert = { file: string; line: number; column: number; check: string; message: string };

export type ValeReport = Record<string, { Line: number; Span: [number, number]; Check: string; Message: string }[]>;

export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };

/** A nonempty set of path routes or one stdin route. */
export type ProseRouteGroup = [ProseRoute, ...ProseRoute[]];

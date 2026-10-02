// The types of checks/general/docs in this package.

export type PathIndex = { known: Set<string>; tasks: Set<string>; isException: (path: string) => boolean };

export type ShapeProblem = [number, string, string];

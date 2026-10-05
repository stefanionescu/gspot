export type PathIndex = { known: Set<string>; tasks: Set<string>; isException: (path: string) => boolean };

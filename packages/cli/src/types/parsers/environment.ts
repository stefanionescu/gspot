/** An environment read, with its literal key when the source names one. */
export type EnvironmentRead = { key: string | undefined; line: number; column: number };

/** The imported environment object or function that a name refers to. */
export type EnvironmentKind = 'os' | 'environ' | 'getenv' | undefined;

export type EnvironmentScope = Map<string, EnvironmentKind>;

export type EnvironmentNames = Map<number, EnvironmentScope>;

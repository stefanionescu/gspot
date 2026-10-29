export type EnvironmentRead = { key: string | undefined; line: number; column: number };

export type EnvironmentKind = 'os' | 'environ' | 'getenv' | undefined;

export type EnvironmentScope = Map<string, EnvironmentKind>;

export type EnvironmentNames = Map<number, Map<string, { position: number; kind: EnvironmentKind }[]>>;

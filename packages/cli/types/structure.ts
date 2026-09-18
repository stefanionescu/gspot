// The structure engine's shared records.

export type Declaration = {
    name: string;
    kind: 'function' | 'class' | 'constant' | 'variable' | 'type' | 'method';
    file: string;
    line: number;
    endLine: number;
    exported: boolean;
    private: boolean;
    statements: number;
    nodes: number;
    parameters: string[];
    body?: string;
    decorators: string[];
};

export type Reference = {
    name: string;
    file: string;
    line: number;
    kind: 'call' | 'reference' | 'import';
};

export type ImportRecord = {
    file: string;
    line: number;
    module: string;
    names: string[];
    typeOnly: boolean;
};

export type CrossFileIndex = {
    scope: string;
    declarations: Declaration[];
    references: Reference[];
    imports: ImportRecord[];
    byName: Map<string, Declaration[]>;
    callsByName: Map<string, Reference[]>;
};

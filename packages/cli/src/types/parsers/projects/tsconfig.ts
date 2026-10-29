import type ts from 'typescript';

export type ParsedTsconfig = Omit<ts.ParsedCommandLine, 'raw'> & {
    raw: { [key: string]: unknown; compilerOptions?: Record<string, unknown> | undefined };
    tsconfigFiles: string[];
    extendedTsconfigFiles: string[];
};

export type TypeScriptProject = {
    path: string;
    config: ParsedTsconfig;
    projects: Map<string, ParsedTsconfig>;
};

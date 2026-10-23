import type ts from 'typescript';

export type TypeScriptConfiguration = Omit<ts.ParsedCommandLine, 'raw'> & {
    raw: { [key: string]: unknown; compilerOptions?: Record<string, unknown> | undefined };
    tsconfigFiles: string[];
    extendedConfigurationFiles: string[];
};

export type TypeScriptProject = {
    path: string;
    config: TypeScriptConfiguration;
    projects: Map<string, TypeScriptConfiguration>;
};

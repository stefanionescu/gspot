import type ts from 'typescript';

/** Native compiler configuration with its validated authored fields and actual configuration reads. */
export type TypeScriptConfiguration = Omit<ts.ParsedCommandLine, 'raw'> & {
    raw: { [key: string]: unknown; compilerOptions?: Record<string, unknown> | undefined };
    configurationFiles: string[];
    extendedConfigurationFiles: string[];
};

/** The nearest authored project and its native reference graph. */
export type TypeScriptProject = {
    path: string;
    config: TypeScriptConfiguration;
    projects: Map<string, TypeScriptConfiguration>;
};

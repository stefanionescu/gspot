import type ts from 'typescript';

/** The parsed tsconfig: its validated fields as written, and the tsconfig files it read. */
export type TypeScriptConfiguration = Omit<ts.ParsedCommandLine, 'raw'> & {
    raw: { [key: string]: unknown; compilerOptions?: Record<string, unknown> | undefined };
    tsconfigFiles: string[];
    extendedConfigurationFiles: string[];
};

/** The nearest tsconfig, and every project that it references. */
export type TypeScriptProject = {
    path: string;
    config: TypeScriptConfiguration;
    projects: Map<string, TypeScriptConfiguration>;
};

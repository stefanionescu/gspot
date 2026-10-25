export type UvCommand = {
    runFolder: string;
    commandArguments: readonly string[];
    executable: string;
    credentials: string[];
    configFile?: string;
};

export type PythonIndexSettings = {
    settings: Record<string, unknown> & { 'find-links'?: string[] | undefined; index?: PythonIndex[] | undefined };
    credentials: string[];
};

export type PythonProjectSettings = { tool: { uv: PythonIndexSettings['settings'] } };

export type PythonIndex = { url: string; [key: string]: unknown };

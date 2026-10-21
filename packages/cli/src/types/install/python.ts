/** One uv operation with its private index settings and the credentials to hide in messages. */
export type UvCommand = {
    runFolder: string;
    commandArguments: readonly string[];
    executable: string;
    credentials: string[];
    configFile?: string;
};

/** Repository index settings and credentials that lockfiles must omit. */
export type PythonIndexSettings = { settings: Record<string, unknown>; credentials: string[] };

export type PythonProjectSettings = { tool: { uv: PythonIndexSettings['settings'] } };

export type PythonIndex = { url: string; [key: string]: unknown };

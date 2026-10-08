/** A Python project prepared for installation: the authored files before install. */
export type PythonInstallation = {
    root: string;
    rootProject: Buffer;
    rootConfiguration: Buffer;
    [Symbol.asyncDispose](): Promise<void>;
};

/** The authored file receiving an isolated uv index and the selected tool runner. */
export type PythonInstallationOptions = {
    indexFile: 'pyproject.toml' | 'uv.toml';
    indexUrl?: string;
    runner: 'mise' | 'none';
};

import type { readFile } from 'node:fs/promises';
/** A Python project prepared for installation: the authored files before install. */
export type PythonInstallation = {
    root: string;
    rootProject: Exclude<Awaited<ReturnType<typeof readFile>>, string>;
    rootConfiguration: Exclude<Awaited<ReturnType<typeof readFile>>, string>;
    [Symbol.asyncDispose](): Promise<void>;
};

/** The authored file receiving an isolated uv index and the selected tool runner. */
export type PythonInstallationOptions = {
    indexFile: 'pyproject.toml' | 'uv.toml';
    indexUrl?: string;
    runner: 'mise' | 'none';
};

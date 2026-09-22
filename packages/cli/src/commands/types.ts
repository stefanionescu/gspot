// Type aliases of the commands modules.

/** The directory and preview flag of commands that support dry runs. */
export type WriteOptions = { cwd: string; isDryRun: boolean };

/** gspot ignore. */
export type IgnoreOptions = {
    cwd: string;
    check: string;
    paths?: string[];
    rule?: string;
    reason?: string;
    remove: boolean;
};

/** gspot add. */
export type AddOptions = WriteOptions & { presets: string[]; scope?: string };

/** gspot remove. */
export type RemoveOptions = WriteOptions & { preset: string; scope?: string };

/** gspot set. */
export type SetOptions = {
    cwd: string;
    key: string;
    items: string[];
    reason?: string;
    scope?: string;
    replace: boolean;
    remove: boolean;
    toDefault: boolean;
};

export type InstallOptions = { cwd: string; isDryRun: boolean };

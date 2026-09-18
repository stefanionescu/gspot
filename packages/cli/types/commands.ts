// Type aliases of the commands modules.

export type Result = { text: string; json: unknown; exitCode: number };

/** The flags every writing command shares. */
export type WriteOptions = { cwd: string; isDryRun: boolean };

/** gspot ignore. */
export type IgnoreOptions = WriteOptions & {
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

/** gspot allow. */
export type AllowOptions = WriteOptions & {
    list: string;
    items: string[];
    reason?: string;
    license?: string;
    remove: boolean;
};

/** gspot set. */
export type SetOptions = WriteOptions & {
    key: string;
    items: string[];
    reason?: string;
    scope?: string;
    replace: boolean;
    remove: boolean;
    toDefault: boolean;
};

/** gspot declare. */
export type DeclareOptions = WriteOptions & {
    paths: string[];
    producedBy?: string;
    vendored: boolean;
    reason?: string;
    remove: boolean;
};

/** One allow list gspot allow can write: where it lives and how its entries look. */
export type AllowList = {
    key: string;
    shape: (items: string[], reason: string | undefined, extra: Record<string, string>) => unknown[];
    isReasonRequired: boolean;
    matches: (entry: unknown, value: string) => boolean;
};

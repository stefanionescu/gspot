/** The files and policy needed to apply a sample for one check. */
export type CaseChanges = {
    check: string;
    files: Record<string, string>;
    /** TOML tables appended to the installed gspot.toml. */
    policy?: string;
    removed?: string[];
    executable?: string[];
};

/** The original bytes or link target restored after a test edit. */
export type OriginalFile = { kind: 'file'; bytes: Uint8Array; mode: number } | { kind: 'symlink'; target: string };

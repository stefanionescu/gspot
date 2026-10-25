export type PreviousFile = { kind: 'file'; bytes: Uint8Array; mode: number } | { kind: 'symlink'; target: string };

export type SandboxWrite = {
    files: Record<string, string>;
    settings: string;
    previousFiles: Map<string, PreviousFile | undefined>;
    removed: readonly string[];
    executable: readonly string[];
};

export type SandboxWrite = {
    files: Record<string, string>;
    settings: string;
    removed: readonly string[];
    executable: readonly string[];
};

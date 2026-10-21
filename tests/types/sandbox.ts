import type { GspotCall } from '#tests/types/samples.ts';
import type { Level } from '#cli/types/configurations.ts';

/** What one sandbox holds and how to prepare it. */
export type SandboxPlan = {
    configurations: readonly string[];
    dependencies?: Readonly<Record<string, string>>;
    files: Readonly<Record<string, string>>;
    tsconfig?: Record<string, unknown>;
    level?: Level;
    before?: (root: string) => void | Promise<void>;
    prepare?: (root: string, environment: Record<string, string>) => void | Promise<void>;
    cleanSource?: string;
};

/** A sandbox with tools installed for its integration tests. */
export type InstalledSandboxPlan = SandboxPlan & {
    without?: readonly string[];
    /** False when every check of the file runs a pinned or system tool, so the sandbox needs no tool project. */
    install?: false;
};

/** A test repository and the command runner that uses its environment. */
export type Sandbox = {
    root: string;
    environment: Record<string, string>;
    run: GspotCall;
};

import type { Level } from '#cli/types/configurations.ts';
import type { GspotCall, SampleFix, CheckSample } from '#tests/types/samples.ts';

/** Settings that installSandbox applies before it installs tools. */
export type SandboxSettings = Pick<InstalledSandboxPlan, 'without' | 'level' | 'install'>;

/** What one sandbox holds and how to prepare it. */
export type SandboxPlan = {
    configurations: readonly string[];
    dependencies?: Readonly<Record<string, string>>;
    files: Readonly<Record<string, string>>;
    tsconfig?: Record<string, unknown>;
    level?: Level;
    before?: (root: string) => void | Promise<void>;
    prepare?: (root: string, environment: Record<string, string>) => void | Promise<void>;
    corrected?: (entry: CheckSample) => SampleFix;
};

/** A sandbox with tools installed for its integration tests. */
export type InstalledSandboxPlan = SandboxPlan & {
    without?: readonly string[];
    /** False when every check of the file runs a pinned or system tool, so the sandbox needs no tool project. */
    install?: false;
};

/** A sandbox whose disposal removes its files. */
export type Sandbox = AsyncDisposable & {
    root: string;
    environment: Record<string, string>;
    run: GspotCall;
};

/** What changeSandbox needs to edit and restore an installed sandbox. */
export type SandboxFiles = Pick<Sandbox, 'root' | 'environment' | 'run'>;

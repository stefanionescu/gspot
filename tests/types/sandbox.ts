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

/** An authored declaration that may select a JavaScript runtime. */
export type RuntimeDetectionRow = {
    name: string;
    runtime: string;
    package: {
        engines?: Record<string, string>;
        scripts?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    source: string;
    detected: boolean;
    toolProjectManifest?: { engines: Record<string, string> };
};

/** What changeSandbox needs to edit and restore an installed sandbox. */
export type SandboxFiles = Pick<Sandbox, 'root' | 'environment' | 'run'>;

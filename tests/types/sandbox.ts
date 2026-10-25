import type { Level } from '#cli/types/configurations.ts';
import type { ProcessOutput } from '#tests/types/processes.ts';

export type SandboxPlan = {
    configurations: readonly string[];
    dependencies?: Readonly<Record<string, string>>;
    files: Readonly<Record<string, string>>;
    json?: Readonly<Record<string, unknown>>;
    level?: Level;
    cleanSource?: string;
};

export type InstalledSandboxPlan = SandboxPlan & {
    without?: readonly string[];
    install?: false;
    commands?: readonly (readonly string[])[];
};

export type Sandbox = {
    root: string;
    run: GspotCall;
};

type GspotCall = (cwd: string, commandArguments: readonly string[]) => Promise<ProcessOutput>;

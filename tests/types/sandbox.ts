import type { GspotCall } from '#tests/types/samples.ts';
import type { Level } from '#cli/types/configurations.ts';

export type SandboxPlan = {
    configurations: readonly string[];
    dependencies?: Readonly<Record<string, string>>;
    files: Readonly<Record<string, string>>;
    json?: Readonly<Record<string, unknown>>;
    level?: Level;
    before?: (root: string) => void | Promise<void>;
    prepare?: (root: string) => void | Promise<void>;
    cleanSource?: string;
};

export type InstalledSandboxPlan = SandboxPlan & {
    without?: readonly string[];
    install?: false;
};

export type Sandbox = {
    root: string;
    run: GspotCall;
};

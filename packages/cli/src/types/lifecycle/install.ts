import type { FileCopy } from '#cli/types/platform/root.ts';
import type { Policy } from '#cli/types/policy/settings.ts';
import type { Planned } from '#cli/types/lifecycle/apply.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import type { ToolOwner, InstalledFile } from '#cli/types/tools/install.ts';
import type { Manifest, InstallationKind } from '#cli/types/configurations.ts';

/** Proposed tool inputs and complete temporary installations awaiting a successful run. */
export type InstallationContext = {
    log: Log;
    generated: Generated;
    inputs: ToolOwner;
    original: Map<string, FileCopy | undefined>;
    prepared: Map<string, FileCopy>;
    plans: Planned[];
    trees: Map<InstallationKind, InstalledFile[]>;
    refreshLockfiles: boolean;
};

/** One installation phase and the commands shown by its preview. */
export type InstallationStep = {
    preview: (
        session: ToolSession,
        manifests: Manifest[],
        generated: Generated,
        refreshLockfiles: boolean,
    ) => Pick<InstallationPlan, 'steps' | 'notes' | 'hooks'>;
    run: (
        session: ToolSession,
        manifests: Manifest[],
        context: InstallationContext,
        preview: Pick<InstallationPlan, 'steps' | 'notes' | 'hooks'>,
    ) => string | Promise<string>;
};

/** The installation summary and whether every applicable phase finished. */
export type InstallationResult = { note: string; exitCode: number };

/** Applicable installation phases with their calculated commands and instructions. */
export type InstallationPlan = {
    hooks?: string;
    steps: string[][];
    notes: string[];
    preparation: Pick<InstallationPlan, 'steps' | 'notes' | 'hooks'> & { phase: InstallationStep };
    phases: Array<Pick<InstallationPlan, 'steps' | 'notes' | 'hooks'> & { phase: InstallationStep }>;
};
/** Policy and repository evidence for installing and inspect clone-local Git hooks. */
export type HookContext = { policy: Policy; repository: Pick<Repository, 'root' | 'hasGit'> };
/** Whether configured hooks are ready, with a human-readable status. */
export type HookStatus = { ready: boolean; text: string };
/** The Git setting to write, or instructions for hooks already owned by the repository. */
export type HookPlan = { path?: string; command?: string[]; note: string };

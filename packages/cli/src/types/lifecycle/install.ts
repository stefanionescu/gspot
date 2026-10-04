import type { Read } from '#cli/types/platform/root.ts';
import type { Policy } from '#cli/types/policy/settings.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { Planned } from '#cli/types/lifecycle/output.ts';
import type { Session } from '#cli/types/execution/session.ts';
import type { Generated } from '#cli/types/generation/output.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import type { ToolOwner, InstalledOutput, InstallationKind } from '#cli/types/tools/install.ts';

/** Proposed tool inputs and complete temporary installations awaiting a successful run. */
export type InstallationContext = {
    log: Log;
    inputs: ToolOwner;
    original: Map<string, Read | undefined>;
    prepared: Map<string, Read>;
    plans: Planned[];
    trees: Map<InstallationKind, InstalledOutput[]>;
    refreshLocks: boolean;
};

/** One installation phase and the commands shown by its preview. */
export type InstallationStep = {
    preview: (
        session: Session,
        manifests: Manifest[],
        generated: Generated,
        refreshLocks: boolean,
    ) => InstallationPreview;
    run: (
        session: Session,
        manifests: Manifest[],
        context: InstallationContext,
        preview: InstallationPreview,
    ) => string | Promise<string>;
};

/** The installation summary and whether every applicable phase finished. */
export type InstallationResult = { note: string; exitCode: number };

/** Acquisition commands and instructions calculated without changing the repository. */
export type InstallationPreview = { steps: string[][]; notes: string[] };
/** Applicable installation phases with their calculated commands and instructions. */
export type InstallationPlan = InstallationPreview & {
    preparation: InstallationPreview & { phase: InstallationStep };
    phases: Array<InstallationPreview & { phase: InstallationStep }>;
};
/** Policy and repository evidence for installing and inspect clone-local Git hooks. */
export type HookContext = { policy: Policy; repository: Pick<Repository, 'root' | 'hasGit'> };
/** Whether configured hooks are ready, with a human-readable status. */
export type HookStatus = { ready: boolean; text: string };
/** The Git setting to write, or instructions for hooks already owned by the repository. */
export type HookPlan = { command?: string[]; note: string };

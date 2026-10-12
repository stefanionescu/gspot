import type { Session } from '#cli/types/planning.ts';
import type { ToolSearch } from '#cli/types/tools/find.ts';
import type { OwnershipLog } from '#cli/types/ownership.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import type { StartRunner, GeneratedFile } from '#cli/types/generation/files.ts';

/** The installation commands, summary, and exit code. */
export type InstallationResult = { note: string; exitCode: number; steps: readonly (readonly string[])[] };

/** Settings and repository evidence for installing and inspecting clone-local Git hooks. */
export type HookContext = { settings: Settings; repository: Pick<Repository, 'root' | 'hasGit'>; runner: StartRunner };
/** Hook readiness and a readable status. */
export type HookStatus = { ready: boolean; text: string };
/** The Git setting to write, or instructions for hooks already owned by the repository. */
export type HookPlan = { path?: string; command?: readonly string[]; note: string };

export type ValeInstallation = {
    level: Settings['level'];
    search: ToolSearch;
    tool: ToolDeclaration;
    timeoutSeconds: number;
    cancelSignal?: AbortSignal | undefined;
};

export type InstallJson = {
    installed?: boolean;
    steps?: readonly (readonly string[])[];
    error?: 'installation';
    message?: string;
};

/** Inputs and attempted commands for writing selected package-manager projects. */
export type ToolProjectInputs = {
    session: Session;
    log: OwnershipLog;
    files: GeneratedFile[];
    steps: (readonly string[])[];
};

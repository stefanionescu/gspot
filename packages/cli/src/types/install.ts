import type { Writer } from '#cli/types/ownership.ts';
import type { Session } from '#cli/types/planning.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import type { StartRunner, GenerationResult } from '#cli/types/generation/files.ts';

/** The install commands, summary, and exit code. */
export type InstallationResult = { note: string; exitCode: number; steps: readonly (readonly string[])[] };

/** Settings and repository evidence for installing and inspecting clone-local Git hooks. */
export type HookContext = { settings: Settings; repository: Pick<Repository, 'root' | 'hasGit'>; runner: StartRunner };
/** Hook readiness and a readable status. */
export type HookStatus = { ready: boolean; text: string };
/** The Git setting to write, or instructions for hooks already owned by the repository. */
export type HookPlan = { path: string; command?: readonly string[]; note: string };

/** Shared state and attempted commands for installing the tools. */
export type InstallContext = {
    cancelSignal?: AbortSignal;
    session: Session;
    writer: Writer;
    generated: GenerationResult;
    tools: ToolDeclaration[];
    mise: string | null;
    steps: (readonly string[])[];
};

/** The successful JSON result of installing the tools. */
export type InstallCommandJson = { installed: boolean; steps: readonly (readonly string[])[] };

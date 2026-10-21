import type { Writer } from '#cli/types/ownership.ts';
import type { Session } from '#cli/types/planning.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';

/** The install commands, summary, and exit code. */
export type InstallationResult = { note: string; steps: readonly (readonly string[])[] };

/** Hook readiness and a readable status. */
export type HookStatus = { ready: boolean; text: string };
/** The Git setting to write, or instructions for hooks already owned by the repository. */
export type HookPlan = { command?: readonly string[]; note: string };

/** Shared state and attempted commands for installing the tools. */
export type InstallContext = {
    session: Session;
    writer: Writer;
    generated: GenerationResult;
    tools: ToolDeclaration[];
    mise: string | null;
    steps: (readonly string[])[];
};

/** The successful JSON result of installing the tools. */
export type InstallCommandJson = { steps: readonly (readonly string[])[] };

import type { Session } from '#cli/types/session.ts';
import type { Writer } from '#cli/types/ownership.ts';
import type { Tool } from '#cli/types/configurations.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';

/** The install commands, summary, and exit code. */
export type InstallResult = { note: string; steps: readonly (readonly string[])[] };

/** Shared state and attempted commands for installing the tools. */
export type ToolInstall = {
    session: Session;
    writer: Writer;
    generated: GenerationResult;
    tools: Tool[];
    misePath: string | null;
    steps: (readonly string[])[];
};

import type { Session } from '#cli/types/session.ts';
import type { Writer } from '#cli/types/ownership.ts';
import type { Tool } from '#cli/types/configurations.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';

/** The install commands that ran, and the install summary. */
export type InstallResult = { note: string; steps: readonly (readonly string[])[] };

/** What the tool install shares, and the commands it tried. */
export type ToolInstall = {
    session: Session;
    writer: Writer;
    generated: GenerationResult;
    tools: Tool[];
    misePath: string | null;
    steps: (readonly string[])[];
};

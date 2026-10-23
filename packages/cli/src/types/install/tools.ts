import type { Writer } from '#cli/types/apply.ts';
import type { Session } from '#cli/types/session.ts';
import type { Tool } from '#cli/types/configurations.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';

export type InstallResult = { note: string; steps: readonly (readonly string[])[] };

export type ToolInstall = {
    session: Session;
    writer: Writer;
    generated: GenerationResult;
    tools: Tool[];
    misePath: string | null;
    steps: (readonly string[])[];
};

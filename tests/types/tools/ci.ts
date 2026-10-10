import type { CiDocument } from '#tests/types/cli/generation/ci.ts';

/** Authored and generated CI files with a deliberate changed-object sample. */
export type CiProject = {
    base: string;
    environment: Record<string, string>;
    generated: CiDocument;
    pipeline: string;
    pipelinePath: string;
    workflowPath: string;
};
/** A job's fake npm installation boundary with explicit success and failure controls. */
export type CiInstallation = { refuse: () => Promise<void>; allow: () => Promise<void> };

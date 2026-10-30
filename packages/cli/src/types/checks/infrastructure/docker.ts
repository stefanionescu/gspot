import type { z } from 'zod';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import type { composeSchema } from '#cli/schemas/checks/infrastructure/docker.ts';

export type ComposeDeclaration = {
    name: string;
    path: string;
    service: NonNullable<z.infer<typeof composeSchema>['services']>[string];
};

export type ComposeFiles = { last: TrackedFile; before: TrackedFile[] };

export type ComposeDocuments = {
    findings: CheckFinding[];
    declarations: ComposeDeclaration[];
    contexts: Map<string, string[]>;
};

export type ImageFinding = { rule: string; message: string };

import type { Scalar } from 'yaml';
import type { z } from 'zod';

import type { WORKFLOW_SHAPE_RULES } from '#cli/config/configurations/github-actions.ts';
import type { composeSchema, supabaseProjectFileSchema } from '#cli/schemas/configurations.ts';
import type { CheckFinding } from '#cli/types/engine/run.ts';
import type { NumberedLine } from '#cli/types/parsers.ts';
import type { TrackedFile } from '#cli/types/repository.ts';

export type WorkflowShapeHit = { kind: keyof typeof WORKFLOW_SHAPE_RULES; node: Scalar };

export type DockerInstruction = { name: string; text: string; line: number };

export type ComposeDeclaration = {
    name: string;
    path: string;
    service: NonNullable<z.infer<typeof composeSchema>['services']>[string];
};

export type DockerIgnoredSource = { line: number; source: string };

export type ComposeFiles = { last: TrackedFile; before: TrackedFile[] };

export type ComposeDocuments = {
    findings: CheckFinding[];
    declarations: ComposeDeclaration[];
    contexts: Map<string, string[]>;
};

export type ImageFinding = { rule: string; message: string };

export type Mount = { path: string; source: string; target: string; text: string };

export type NginxMounts = { configs: Array<Pick<Mount, 'source' | 'target'>>; certificate: string; key: string };

export type HeaderBlock = { path: string; headers: Array<{ name: string; value: string }> };

export type ParsedHeadersFile = { blocks: HeaderBlock[]; errors: NumberedLine[] };

export type SupabaseProjectFile = z.infer<typeof supabaseProjectFileSchema>;

export type FunctionEntrypoint = { path: string; importMap?: string | undefined };

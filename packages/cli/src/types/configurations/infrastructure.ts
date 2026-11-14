import type { z } from 'zod';
import type { Node, Scalar } from 'yaml';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { CheckFinding } from '#cli/types/engine/run.ts';
import type { composeSchema } from '#cli/schemas/configurations.ts';
import type { SERVICE_SECURITY_RULES } from '#cli/config/configurations/docker.ts';
import type { WORKFLOW_SHAPE_RULES } from '#cli/config/configurations/github-actions.ts';

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

export type ComposeHit = { kind: keyof typeof SERVICE_SECURITY_RULES; node: Node };

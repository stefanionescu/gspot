import type { z } from 'zod';
import type { Read } from '#cli/types/platform/root.ts';
import type { MergeRecord } from '#cli/types/lifecycle/output.ts';
import type { fieldsSchema } from '#cli/lifecycle/ownership/schema.ts';
import type { OwnershipEntry } from '#cli/types/lifecycle/ownership.ts';
import type { ConfigurationOutput } from '#cli/types/generation/output.ts';

export type MergeRequest = {
    changes: ConfigurationOutput['changes'];
    path: string;
    current: Read | undefined;
    existing: OwnershipEntry | undefined;
    matchesInstalled: boolean;
    canReplace: boolean;
};

export type Field = z.infer<typeof fieldsSchema>[number];

export type MergePlan = {
    next: Read;
    configuration: MergeRecord;
    status: 'changed' | 'unchanged';
};

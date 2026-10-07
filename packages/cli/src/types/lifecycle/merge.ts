import type { z } from 'zod';
import type { FileCopy } from '#cli/types/platform/root.ts';
import type { KeyPath } from '#cli/types/platform/document.ts';
import type { MergeRecord } from '#cli/types/lifecycle/output.ts';
import type { fieldsSchema } from '#cli/lifecycle/ownership/schema.ts';
import type { OwnershipEntry } from '#cli/types/lifecycle/ownership.ts';
import type { ConfigurationOutput } from '#cli/types/generation/output.ts';

export type MergeRequest = {
    changes: ConfigurationOutput['changes'];
    path: string;
    current: FileCopy | undefined;
    existing: OwnershipEntry | undefined;
    matchesInstalled: boolean;
    canReplace: boolean;
};

export type Field = z.infer<typeof fieldsSchema>[number];

export type MergePlan = {
    next: FileCopy;
    configuration: MergeRecord;
    status: 'changed' | 'unchanged';
};

/** Text and field ownership calculated for a managed configuration merge. */
export type MergePlanContents = {
    format: MergeRecord['format'];
    text: string;
    nextText: string;
    fields: Field[];
    parents: KeyPath[];
};

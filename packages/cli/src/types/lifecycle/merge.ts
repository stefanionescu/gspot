// The types of lifecycle/merge in this package.
import type { z } from 'zod';
import type { Read } from '#cli/types/platform/platform.ts';
import type { MergeRecord } from '#cli/types/lifecycle/lifecycle.ts';
import type { fieldsSchema } from '#cli/lifecycle/ownership/schema.ts';
import type { OwnershipEntry } from '#cli/types/lifecycle/ownership.ts';
import type { ConfigurationFormat } from '#cli/types/generation/generation.ts';

export type MergeRequest = {
    changes: { path: KeyPath; value: unknown }[];
    path: string;
    format: ConfigurationFormat;
    current: Read | undefined;
    existing: OwnershipEntry | undefined;
    matchesInstalled: boolean;
    replace: boolean;
};

export type KeyPath = (string | number)[];
export type Field = z.infer<typeof fieldsSchema>[number];

export type MergePlan = {
    next: Read;
    configuration: MergeRecord;
    status: 'changed' | 'unchanged';
};

/** A configuration document that preserves comments and layout when reading and editing keys. */
export type KitDocument = {
    value(path: KeyPath): unknown;
    set(path: KeyPath, value: unknown): void;
    text(): string;
};

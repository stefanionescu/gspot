// The types of lifecycle/merge in this package.
import type { z } from 'zod';
import type { Read } from '#cli/types/platform/platform.ts';
import type { OwnershipEntry } from '#cli/types/lifecycle/ownership.ts';
import type { ConfigurationFormat } from '#cli/types/generation/generation.ts';
import type { ConfigurationOwnership } from '#cli/types/lifecycle/lifecycle.ts';
import type { configurationFieldsSchema } from '#cli/lifecycle/ownership/schema.ts';

export type ConfigurationWriteRequest = {
    changes: { path: KeyPath; value: unknown }[];
    path: string;
    format: ConfigurationFormat;
    current: Read | undefined;
    existing: OwnershipEntry | undefined;
    matchesInstalled: boolean;
    replace: boolean;
};

export type KeyPath = (string | number)[];
export type Field = z.infer<typeof configurationFieldsSchema>[number];

export type KitPlan = {
    next: Read;
    configuration: ConfigurationOwnership;
    status: 'changed' | 'unchanged';
};

/** A configuration document that preserves comments and layout when reading and editing keys. */
export type KitDocument = {
    value(path: KeyPath): unknown;
    set(path: KeyPath, value: unknown): void;
    text(): string;
};

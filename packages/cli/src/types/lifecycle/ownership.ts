// The types of lifecycle/ownership in this package.
import type { z } from 'zod';
import type { Read, Root } from '#cli/types/platform/platform.ts';
import type { OWNED_KINDS } from '#cli/config/lifecycle/ownership.ts';
import type { identitySchema, ownershipSchema } from '#cli/lifecycle/ownership/schema.ts';

export type OwnedBlock = NonNullable<OwnershipEntry['block']>;

export type PendingOwnership = NonNullable<Ownership['pending']>[number];

export type Outcome = 'changed' | 'unchanged' | 'preserved';

export type Restoration = { next?: Read };

export type PlannedBlock = { nextText: string; block: OwnedBlock };

export type Ownership = z.infer<typeof ownershipSchema>;
export type OwnershipEntry = Ownership['files'][number];
export type Identity = z.infer<typeof identitySchema>;

/** The open log: the locked root, the recorded state, and the operations that read and write it. */
export type Log = {
    files: Root;
    state: Ownership;
    save(): void;
    entryFor(path: string): OwnershipEntry | undefined;
    finish(): void;
};

export type ReplacementRequest = {
    path: string;
    next: Read;
    kind: OwnedKind;
    canReplace?: boolean | undefined;
    expected?: Read | undefined;
    proposed?: ReadonlyMap<string, Read | undefined> | undefined;
};

/** The kind of file a gspot write owns. */
export type OwnedKind = (typeof OWNED_KINDS)[number];

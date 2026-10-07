import type { z } from 'zod';
import type { OWNED_KINDS } from '#cli/config/lifecycle/ownership.ts';
import type { ownershipSchema } from '#cli/lifecycle/ownership/schema.ts';
import type { Root, FileCopy, Proposed } from '#cli/types/platform/root.ts';

export type Restoration = { next?: FileCopy };

export type Outcome = 'changed' | 'unchanged' | 'preserved';

export type OwnedBlock = NonNullable<OwnershipEntry['block']>;

export type PlannedBlock = { nextText: string; block: OwnedBlock };

export type ReplacementRequest = {
    path: string;
    next: FileCopy;
    kind: OwnedKind;
    canReplace?: boolean | undefined;
    expected?: FileCopy | undefined;
    proposed?: Proposed | undefined;
};

/** The kind of file a gspot write owns. */
export type OwnedKind = (typeof OWNED_KINDS)[number];

export type PendingOwnership = NonNullable<Ownership['pending']>[number];

export type Ownership = z.infer<typeof ownershipSchema>;

export type OwnershipEntry = Ownership['files'][number];

export type Identity = NonNullable<OwnershipEntry['installed']>;

/** The open log: the locked root, the recorded state, and the operations that read and write it. */
export type Log = {
    [Symbol.dispose](): void;
    files: Root;
    state: Ownership;
    save(): void;
    entryFor(path: string): OwnershipEntry | undefined;
    finish(): void;
};

/** Side folders for atomic replacement and recovery of one tool project installation. */
export type InstallationFolders = { folder: string; staging: string; previous: string };

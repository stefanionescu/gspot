// The types of lifecycle in this package.
import type { z } from 'zod';
import type { WriteResult } from '#cli/types/policy/policy.ts';
import type { ConfinedRoot, FileSnapshot } from '#cli/types/platform.ts';

import type {
    configurationFieldsSchema,
    identitySchema,
    originalSchema,
    ownershipSchema,
} from '#cli/lifecycle/journal.ts';

export type OwnedBlock = NonNullable<OwnershipEntry['block']>;
export type ConfigurationWriteRequest = {
    changes: { path: KeyPath; value: unknown }[];
    path: string;
    format: ConfigurationFormat;
    current: FileSnapshot | undefined;
    existing: OwnershipEntry | undefined;
    matchesInstalled: boolean;
    takeover: boolean;
};
export type PendingOwnership = NonNullable<OwnershipState['pending']>[number];
export type ApplyReport = {
    preserved: string[];
    written: string[];
    unchanged: string[];
    removed: string[];
    blocks: string[];
    packages: string[];
    notes: string[];
};
export type KeyPath = (string | number)[];
export type Field = z.infer<typeof configurationFieldsSchema>[number];
export type ConfigurationOwnership = NonNullable<OwnershipEntry['configuration']>;
export type ConfigurationPlan = {
    next: FileSnapshot;
    configuration: ConfigurationOwnership;
    status: 'changed' | 'unchanged';
};
export type Outcome = 'changed' | 'unchanged' | 'preserved';
export type PreparedWrite = {
    path: string;
    current: FileSnapshot | undefined;
    next: FileSnapshot | undefined;
    entry: OwnershipEntry | undefined;
    recovery: z.infer<typeof originalSchema> | undefined;
};
export type PreparedPolicy = WriteResult & { original: FileSnapshot };
export type DriftEntry = {
    path: string;
    kind: 'changed' | 'missing' | 'stray' | 'conflict';
    diff?: string;
    rules?: { path: string; added: string[]; removed: string[]; changed: string[] }[];
    ruleError?: string;
};
export type Restoration = { next?: FileSnapshot };
export type BlockStyle = 'markdown' | 'hash';
export type BlockSpan = { start: number; end: number };
export type PlannedBlock = { nextText: string; block: OwnedBlock };
export type TakeoverRemovalResult = { removed: string[]; preserved: string[] };
export type OwnershipState = z.infer<typeof ownershipSchema>;
export type OwnershipEntry = OwnershipState['files'][number];
export type Identity = z.infer<typeof identitySchema>;
export type Original = z.infer<typeof originalSchema>;
/** The open journal: the locked root, the recorded state, and the operations that read and write it. */
export type Journal = {
    confined: ConfinedRoot;
    state: OwnershipState;
    save(): void;
    backup(path: string, file: FileSnapshot): Original;
    entryFor(path: string): OwnershipEntry | undefined;
    finish(): void;
};
/** What one operation proposes for one file: the file now, its record, the outcome, and what to write. */
export type FileProposal = {
    path: string;
    current: FileSnapshot | undefined;
    previous: OwnershipEntry | undefined;
    status: 'changed' | 'unchanged' | 'preserved';
    next?: FileSnapshot;
    entry?: OwnershipEntry;
    saveOriginal?: boolean;
};
export type LifecycleOwner = {
    beginInstallation(kind: 'npm' | 'python'): void;
    finishInstallation(kind: 'npm' | 'python'): void;
    proposeConfiguration(
        path: string,
        format: ConfigurationFormat,
        changes: { path: (string | number)[]; value: unknown }[],
        takeover?: boolean,
    ): FileProposal;
    proposeReplacement(
        path: string,
        next: FileSnapshot,
        kind: OwnershipEntry['kind'],
        takeover?: boolean,
        expected?: FileSnapshot,
        proposed?: ReadonlyMap<string, FileSnapshot | undefined>,
    ): FileProposal;
    proposeBlock(path: string, body: string, style: BlockStyle): FileProposal;
    applyProposal(proposal: FileProposal): Outcome;
    applyProposals(proposals: FileProposal[]): Outcome[];
    replaceBlock(path: string, body: string, style: BlockStyle): Outcome;
    read(path: string): FileSnapshot | undefined;
    paths(): string[];
    installedPaths(): string[];
    proposeRetirement(path: string, expected: FileSnapshot): FileProposal;
    replace(
        path: string,
        next: FileSnapshot,
        kind: OwnershipEntry['kind'],
        takeover?: boolean,
        expected?: FileSnapshot,
    ): Outcome;
    proposeRestoration(path: string, original?: FileSnapshot): FileProposal;
    restore(path: string, original?: FileSnapshot): 'changed' | 'preserved';
    close(): void;
};
export type ConfigurationFormat = 'json' | 'yaml' | 'toml';
/** A configuration file read and edited by key path, keeping its comments and layout. */
export type ConfigurationDocument = {
    value(path: KeyPath): unknown;
    set(path: KeyPath, value: unknown): void;
    text(): string;
};

export type ReplacementRequest = {
    path: string;
    next: FileSnapshot;
    kind: OwnershipEntry['kind'];
    takeover?: boolean | undefined;
    expected?: FileSnapshot | undefined;
    proposed?: ReadonlyMap<string, FileSnapshot | undefined> | undefined;
};

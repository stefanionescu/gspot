// The types of lifecycle in this package.
import type { z } from 'zod';
import type { Read, Root } from '#cli/types/platform.ts';
import type { WriteResult } from '#cli/types/policy/policy.ts';
import type { identitySchema, ownershipSchema, configurationFieldsSchema } from '#cli/lifecycle/log.ts';

export type OwnedBlock = NonNullable<OwnershipEntry['block']>;
export type ConfigurationWriteRequest = {
    changes: { path: KeyPath; value: unknown }[];
    path: string;
    format: ConfigurationFormat;
    current: Read | undefined;
    existing: OwnershipEntry | undefined;
    matchesInstalled: boolean;
    replace: boolean;
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
export type KitPlan = {
    next: Read;
    configuration: ConfigurationOwnership;
    status: 'changed' | 'unchanged';
};
export type Outcome = 'changed' | 'unchanged' | 'preserved';
export type PreparedPolicy = WriteResult & { original: Read };
export type DriftEntry = {
    path: string;
    kind: 'changed' | 'missing' | 'stray' | 'conflict';
    diff?: string;
    rules?: { path: string; added: string[]; removed: string[]; changed: string[] }[];
    ruleError?: string;
};
export type Restoration = { next?: Read };
export type BlockStyle = 'markdown' | 'hash';
export type BlockSpan = { start: number; end: number };
export type PlannedBlock = { nextText: string; block: OwnedBlock };
export type ReplaceRemovalResult = { removed: string[]; preserved: string[] };
export type OwnershipState = z.infer<typeof ownershipSchema>;
export type OwnershipEntry = OwnershipState['files'][number];
export type Identity = z.infer<typeof identitySchema>;
/** A private tool installation gspot writes whole: the npm tools or the Python environment. */
export type InstallationKind = 'npm' | 'python';
/** One file of a finished installation, at its path under the installation folder. */
export type InstalledOutput = { path: string; file: Read };
/** The open log: the locked root, the recorded state, and the operations that read and write it. */
export type Log = {
    files: Root;
    state: OwnershipState;
    save(): void;
    entryFor(path: string): OwnershipEntry | undefined;
    finish(): void;
};
/** What one operation proposes for one file: the file now, its record, the outcome, and what to write. */
export type Planned = {
    path: string;
    current: Read | undefined;
    previous: OwnershipEntry | undefined;
    status: 'changed' | 'unchanged' | 'preserved';
    next?: Read;
    entry?: OwnershipEntry;
};
export type Owner = {
    beginInstallation(kind: InstallationKind): void;
    finishInstallation(kind: InstallationKind): void;
    installTree(kind: InstallationKind, outputs: InstalledOutput[]): void;
    removeInstallation(kind: InstallationKind): void;
    proposeConfiguration(
        path: string,
        format: ConfigurationFormat,
        changes: { path: (string | number)[]; value: unknown }[],
        replace?: boolean,
    ): Planned;
    proposeReplacement(
        path: string,
        next: Read,
        kind: OwnershipEntry['kind'],
        replace?: boolean,
        expected?: Read,
        proposed?: ReadonlyMap<string, Read | undefined>,
    ): Planned;
    proposeBlock(path: string, body: string, style: BlockStyle): Planned;
    applyPlan(plan: Planned): Outcome;
    applyPlans(plans: Planned[]): Outcome[];
    replaceBlock(path: string, body: string, style: BlockStyle): Outcome;
    read(path: string): Read | undefined;
    paths(): string[];
    installedPaths(): string[];
    proposeRetirement(path: string, expected: Read): Planned;
    replace(path: string, next: Read, kind: OwnershipEntry['kind'], replace?: boolean, expected?: Read): Outcome;
    proposeRestoration(path: string): Planned;
    close(): void;
};
export type ConfigurationFormat = 'json' | 'yaml' | 'toml';
/** A configuration document that preserves comments and layout when reading and editing keys. */
export type KitDocument = {
    value(path: KeyPath): unknown;
    set(path: KeyPath, value: unknown): void;
    text(): string;
};

export type ReplacementRequest = {
    path: string;
    next: Read;
    kind: OwnershipEntry['kind'];
    replace?: boolean | undefined;
    expected?: Read | undefined;
    proposed?: ReadonlyMap<string, Read | undefined> | undefined;
};

import type { OWNED_KINDS } from '#cli/config/ownership.ts';
import type { JsonValue } from '#cli/types/parsers/json.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { BlockStyle } from '#cli/types/system/managed-blocks.ts';
import type { FileCopy, SafeFolder } from '#cli/types/system/safe-folder.ts';

type Outcome = 'changed' | 'unchanged' | 'preserved';
export type OwnedKind = (typeof OWNED_KINDS)[number];
export type Identity = { hash: string; isLink?: true | undefined };
export type OwnedBlock = { style: BlockStyle; installed: string; original: string; prefix: string; created: boolean };
export type PlannedBlock = { nextText: string; block: OwnedBlock };
export type ManagedKey = { path: KeyPath; installed: JsonValue; original?: JsonValue | undefined };
export type ManagedKeys = {
    format: 'toml' | 'json';
    fields: ManagedKey[];
    parents?: KeyPath[] | undefined;
    edited: boolean;
    created: boolean;
};
export type OwnedFile = {
    path: string;
    kind: OwnedKind;
    written?: Identity | undefined;
    adopted?: true | undefined;
    keys?: ManagedKeys | undefined;
    block?: OwnedBlock | undefined;
};
export type PendingWrite = {
    path: string;
    before?: Identity | undefined;
    after?: Identity | undefined;
    entry?: OwnedFile | undefined;
};
export type OwnershipState = {
    version: 1;
    files: OwnedFile[];
    installed?: Array<'npm' | 'python' | 'vale'> | undefined;
    pending?: PendingWrite[] | undefined;
};
export type OwnershipLog = {
    [Symbol.dispose](): void;
    files: SafeFolder;
    state: OwnershipState;
    save(): void;
    entryFor(path: string): OwnedFile | undefined;
    finish(): void;
};
export type Restoration = { next?: FileCopy };
export type ReplacementRequest = {
    path: string;
    next: FileCopy;
    kind: OwnedKind;
    canReplace?: boolean | undefined;
    expected?: FileCopy | undefined;
};
export type KeyChangeRequest = {
    changes: FileEdit['changes'];
    path: string;
    current: FileCopy | undefined;
    existing: OwnedFile | undefined;
    matchesInstalled: boolean;
    canReplace: boolean;
};
export type KeyChangePlan = { next: FileCopy; keys: ManagedKeys; status: 'changed' | 'unchanged' };
export type KeyChangeContents = {
    format: ManagedKeys['format'];
    text: string;
    nextText: string;
    fields: ManagedKey[];
    parents: KeyPath[];
};

export type FileEdit = {
    path: string;
    changes: { path: KeyPath; value: JsonValue }[];
};
export type WritePlan = {
    path: string;
    before: FileCopy | undefined;
    status: Outcome;
    after?: FileCopy;
    entry?: OwnedFile;
};

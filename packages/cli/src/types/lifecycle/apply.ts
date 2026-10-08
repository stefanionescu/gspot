import type { FileCopy } from '#cli/types/platform/root.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import type { Outcome, OwnershipEntry as OwnedFile } from '#cli/types/lifecycle/ownership.ts';

export type WriteRequest = {
    agentRulesEnabled: boolean;
    root: string;
    generated: Generated;
    report: ApplyReport;
    retained: { prose: boolean; packages: boolean; python: boolean };
    reviewedOriginals?: ReadonlyMap<string, FileCopy | undefined> | undefined;
    conflictedOutputs?: ReadonlyMap<string, FileCopy>;
};

export type ApplyReport = {
    written: string[];
    unchanged: string[];
    removed: string[];
    /** Authored files gspot changed in place: a managed block or tool settings. */
    updated: string[];
    notes: string[];
};

export type MergeRecord = NonNullable<OwnedFile['configuration']>;

/** What one operation proposes for one file: the file now, its record, the outcome, and what to write. */
export type Planned = {
    path: string;
    before: FileCopy | undefined;
    status: Outcome;
    after?: FileCopy;
    entry?: OwnedFile;
};

export type Drift = {
    path: string;
    kind: 'changed' | 'missing' | 'stray' | 'conflict';
    diff?: string;
    rules?: { path: string; added: string[]; removed: string[]; changed: string[] }[];
};

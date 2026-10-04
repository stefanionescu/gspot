import type { Read } from '#cli/types/platform/root.ts';
import type { Generated } from '#cli/types/generation/output.ts';
import type { Outcome, OwnershipEntry as OwnedFile } from '#cli/types/lifecycle/ownership.ts';

export type WriteRequest = {
    agentRulesEnabled: boolean;
    root: string;
    generated: Generated;
    report: ApplyReport;
    retained: { prose: boolean; packages: boolean; python: boolean };
    reviewedOriginals?: ReadonlyMap<string, Read> | undefined;
    conflictedOutputs?: ReadonlyMap<string, Read>;
};

export type ApplyReport = {
    preserved: string[];
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
    before: Read | undefined;
    previous: OwnedFile | undefined;
    status: Outcome;
    after?: Read;
    entry?: OwnedFile;
};

export type Drift = {
    path: string;
    kind: 'changed' | 'missing' | 'stray' | 'conflict';
    diff?: string;
    rules?: { path: string; added: string[]; removed: string[]; changed: string[] }[];
};

import type { Generated } from '#cli/types/generation/files.ts';
import type { FileCopy } from '#cli/types/system/safe-folder.ts';

export type WriteRequest = {
    generated: Generated;
    expectedPaths: ReadonlySet<string>;
    report: ApplyReport;
    retained: { prose: boolean; packages: boolean; python: boolean };
    reviewedOriginals?: ReadonlyMap<string, FileCopy | undefined> | undefined;
};

export type ApplyReport = {
    written: string[];
    unchanged: string[];
    removed: string[];
    /** Authored files gspot changed in place: a managed block or tool settings. */
    updated: string[];
    notes: string[];
};

/** What one operation proposes for one file: the file now, its record, the outcome, and what to write. */

export type StaleFile = {
    path: string;
    kind: 'changed' | 'missing' | 'stray';
    diff?: string;
};

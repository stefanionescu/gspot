export type ApplyReport = {
    written: string[];
    unchanged: string[];
    removed: string[];
    /** Authored files gspot changed in place: a managed block or tool settings. */
    updated: string[];
    notes: string[];
};

export type StaleFile = {
    path: string;
    kind: 'changed' | 'missing' | 'stray';
    diff?: string;
};

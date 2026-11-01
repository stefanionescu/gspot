export type Revision = { kind: 'index' } | { kind: 'commit'; hash: string };

export type PushRevision = {
    base: string;
    hash: string;
    tree: string;
    refs: string[];
    commits: string[];
    range: string[];
    shallow: boolean;
    paths?: string[];
};

export type PushedRevisions = {
    revisions: PushRevision[];
    skipped: {
        ref: string;
        hash: string;
        reason: 'deleted ref' | 'non-commit object' | 'the commit has no gspot.toml' | 'no changed paths';
    }[];
};

export type PushLine = { localRef: string; localHash: string; remoteRef: string; remoteHash: string };

export type Comparison = { base: string; changed: string[] | undefined; range: string[] };

export type PushSearch = {
    root: string;
    cancelSignal: AbortSignal | undefined;
    commits: Map<string, string | undefined>;
    remote: string | undefined;
    boundaries: Set<string>;
};

export type MergeBase = { hash?: string; note?: string };

export type ChangedPaths = { reference: string; paths?: string[]; commits?: string[]; note?: string };

export type StagedPaths = { staged: string[]; unstaged: number };

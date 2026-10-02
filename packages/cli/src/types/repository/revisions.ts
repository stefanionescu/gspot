// The types of repository/revisions in this package.

type RefMapping = { source: string; destination: string };

export type PushSelection = {
    revisions: PushRevision[];
    notApplicable: { ref: string; object: string; reason: 'deleted ref' | 'non-commit object' }[];
};

export type ChangedSet = { reference: string; paths: string[]; commits?: string[] };
export type StagedSet = { staged: string[]; unstaged: number };

export type PushRevision = {
    object: string;
    tree: string;
    refs: string[];
    commits: string[];
    historyComplete: boolean;
    paths?: string[];
};

export type PushLine = { localRef: string; localHash: string; remoteRef: string; remoteHash: string };
export type Comparison = { changed: string[] | undefined; excluded: string[] };
export type PushSearch = {
    root: string;
    cancelSignal: AbortSignal | undefined;
    commits: Map<string, string | undefined>;
    fetched: string[];
    shallow: boolean;
    boundaries: Set<string>;
};
export type RefRules = { mappings: RefMapping[]; excluded: string[] };
export type ParsedMapping = { kind: 'skip' } | { kind: 'unusable' } | ({ kind: 'mapping' } & RefMapping);

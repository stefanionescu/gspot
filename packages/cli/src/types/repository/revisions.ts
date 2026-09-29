// The types of repository/revisions in this package.
export type RevisionSource = { kind: 'index' } | { kind: 'commit'; hash: string };
export type PushRevision = {
    object: string;
    tree: string;
    refs: string[];
    commits: string[];
    historyComplete: boolean;
    paths?: string[];
};
export type PushSelection = {
    revisions: PushRevision[];
    notApplicable: { ref: string; object: string; reason: 'deleted ref' | 'non-commit object' }[];
};
export type GitEntry = { mode: string; hash: string; path: string };
export type Directory = { folder: string; dependency: string };
export type ChangedSet = { reference: string; paths: string[] };
export type StagedSet = { staged: string[]; unstaged: number };
export type PushLine = { localRef: string; localHash: string; remoteRef: string; remoteHash: string };
export type Comparison = { changed: string[] | undefined; excluded: string[] };
export type PushContext = {
    root: string;
    cancelSignal: AbortSignal | undefined;
    commits: Map<string, string | undefined>;
    fetched: string[];
    shallow: boolean;
    boundaries: Set<string>;
};
export type RefMapping = { source: string; destination: string };
export type RefRules = { mappings: RefMapping[]; excluded: string[] };
export type ParsedMapping = { kind: 'skip' } | { kind: 'unusable' } | ({ kind: 'mapping' } & RefMapping);

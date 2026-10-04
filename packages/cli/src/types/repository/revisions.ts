export type Revision = { kind: 'index' } | { kind: 'commit'; hash: string };

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
    skipped: { ref: string; object: string; reason: 'deleted ref' | 'non-commit object' }[];
};

export type PushLine = { localRef: string; localHash: string; remoteRef: string; remoteHash: string };

/** Git's pre-push protocol input and the remote name supplied to the hook. */
export type PushInput = { stdin: string; remote?: string };

export type Comparison = { changed: string[] | undefined; excluded: string[] };

export type PushSearch = {
    root: string;
    cancelSignal: AbortSignal | undefined;
    commits: Map<string, string | undefined>;
    remote: string | undefined;
    fetched?: Promise<string[]>;
    shallow: boolean;
    boundaries: Set<string>;
};

export type RefMapping = { source: string; destination: string };

export type RefRules = { mappings: RefMapping[]; excluded: string[] };

export type Refspec = { kind: 'skip' } | { kind: 'unusable' } | ({ kind: 'mapping' } & RefMapping);

export type ChangedPaths = { reference: string; paths: string[]; commits?: string[] };

export type StagedPaths = { staged: string[]; unstaged: number };

/** Selected commit objects or the Git diagnostic that prevented their selection. */
export type CommitSelection = string[] | { error: string };

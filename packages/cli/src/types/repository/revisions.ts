// The types of repository/revisions in this package.
import type { ConfinedRoot } from '#cli/types/platform.ts';

/** An installed virtual environment whose launchers and loader metadata name working-tree paths. */
export type PythonLauncher = {
    directory: string;
    source: string;
    names: [string, ...string[]];
    sitePackages: string;
    hosts: ReadonlySet<string>;
};
/** The snapshot the relocation writes, the roots it reads, and the cancellation it honours. */
export type RelocationContext = { root: string; snapshot: string; selected: ConfinedRoot; cancelSignal?: AbortSignal };
export type SnapshotSource = { kind: 'index' } | { kind: 'commit'; object: string };
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
export type GitEntry = { mode: string; object: string; path: string };
export type Directory = { folder: string; dependency: string };
export type ChangedSet = { reference: string; paths: string[] };
export type StagedSet = { staged: string[]; unstaged: number };
export type PushLine = { localRef: string; localObject: string; remoteRef: string; remoteObject: string };
export type Comparison = { changed: string[] | undefined; excluded: string[] };
export type PushContext = {
    root: string;
    cancelSignal: AbortSignal | undefined;
    commits: Map<string, string | undefined>;
    fetched: string[];
    shallow: boolean;
    boundaries: Set<string>;
};
export type FetchMapping = { source: string; destination: string };
export type FetchRules = { mappings: FetchMapping[]; excluded: string[] };
export type ParsedMapping = { kind: 'skip' } | { kind: 'unusable' } | ({ kind: 'mapping' } & FetchMapping);

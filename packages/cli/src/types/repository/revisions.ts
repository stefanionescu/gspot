// The types of repository/revisions in this package.
import type { Root } from '#cli/types/platform.ts';

/** An installed virtual environment whose launchers and loader metadata name working-tree paths. */
export type PythonLauncher = {
    directory: string;
    source: string;
    names: [string, ...string[]];
    sitePackages: string;
    hosts: ReadonlySet<string>;
};
/** The snapshot the relocation writes, the roots it reads, and the cancellation it honors. */
export type RelocationContext = {
    root: string;
    destination: string;
    selected: Root;
    cancelSignal?: AbortSignal;
};
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

/** Validated executable headers and bounded reads for Windows launcher resources. */
export type WindowsImage = {
    bytes: Buffer;
    coff: number;
    optional: number;
    directories: number;
    sectionTable: number;
    count: number;
    sections: number[];
    short: (offset: number) => number;
    word: (offset: number) => number;
    range: (offset: number, length: number) => number;
    location: (rva: number, size: number) => number;
};
/** The resource descriptor and its validated payload range. */
export type WindowsResource = { descriptor: number; offset: number; size: number };

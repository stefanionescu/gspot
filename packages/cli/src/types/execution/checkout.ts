// The types of execution/checkout in this package.

// The types of repository/revisions in this package.
export type RevisionSource = { kind: 'index' } | { kind: 'commit'; hash: string };

export type GitEntry = { mode: string; hash: string; path: string };
export type Directory = { folder: string; dependency: string };

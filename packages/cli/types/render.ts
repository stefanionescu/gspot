// Generated files: what sync renders, and what drift compares.

export type GeneratedFile = {
    path: string;
    content: string;
    readOnly: boolean;
    executable?: boolean;
    kind: 'config' | 'stub' | 'hook' | 'runner' | 'workflow' | 'rules' | 'baseline' | 'version' | 'managed-block';
    preset?: string;
};

export type ManagedBlock = {
    path: string;
    block: string;
    style: 'markdown' | 'hash' | 'json' | 'yaml';
    key?: string;
};

export type DriftEntry = {
    path: string;
    kind: 'changed' | 'missing' | 'stray';
    diff?: string;
};

export type TakeoverPlan = {
    write: { path: string; note: string }[];
    remove: { path: string; note: string }[];
    carried: { from: string; count: number; into: string }[];
    change: { path: string; note: string }[];
    noLongerRuns: { path: string; note: string }[];
    baselines: { rules: number; findings: number };
    ignores: { check: string; rule?: string; reason: string }[];
};

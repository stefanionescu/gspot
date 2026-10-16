import type { StageFilter } from '#cli/types/planning.ts';
import type { CHECK_HOOKS } from '#cli/config/generation/hooks.ts';
import type { RunReport, CheckResult } from '#cli/types/execution/check.ts';
import type { PushInput, StagedPaths, ChangedPaths, PushSelection } from '#cli/types/repository/revisions.ts';

type Checked = { hash: string; refs: string[]; commits: string[]; historyComplete: boolean; report: RunReport };

/** The push report: one run report for every distinct tree that Git's pre-push input names. */
type PushReport = {
    canceled?: { pendingRefs: string[] };
    revisions: Checked[];
    skipped: PushSelection['skipped'];
    exitCode: number;
};

/** The selected index paths when present, and the count of unstaged changes. */
type StagedFiles = StagedPaths | { staged: undefined; unstaged: number };

type RunFilters = {
    paths: string[] | undefined;
    changed: ChangedPaths | undefined;
    staging: StagedFiles;
    stage: StageFilter;
};

type CheckOptions = {
    hook?: (typeof CHECK_HOOKS)[number];
    onResult?: (result: CheckResult) => void;
    cwd: string;
    only?: string[];
    paths: string[];
    staged: boolean;
    push?: PushInput;
    base?: string;
    fix: boolean;
    isDryRun: boolean;
    stage?: StageFilter;
    messageFile?: string;
    verbose: boolean;
};

/** What a copy stands for: the staged index or a pushed commit, and the repository whose tools it runs. */
type RevisionSource = {
    base?: string;
    commits?: string[];
    historyComplete?: boolean;
    content: 'index' | 'commit';
    installedRoot: string;
    reference: string;
    reportRoot?: string;
    staged?: StagedPaths;
    changed?: string[];
};

export type { PushReport, RunFilters, CheckOptions, RevisionSource };

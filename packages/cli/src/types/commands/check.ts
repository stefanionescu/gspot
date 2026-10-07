import type { StageFilter } from '#cli/types/planning.ts';
import type { CommandResult, OutputOptions } from '#cli/types/output.ts';
import type { RunReport, CheckResult } from '#cli/types/execution/runtime.ts';
import type { PushInput, StagedPaths, ChangedPaths, PushSelection } from '#cli/types/repository/revisions.ts';

export type Checked = PushReport['revisions'][number];

export type CheckCommandResult = CommandResult & { report?: RunReport };

/** The push report: one run report for every distinct tree that Git's pre-push input names. */
export type PushReport = {
    canceled?: { pendingRefs: string[] };
    revisions: { object: string; refs: string[]; commits: string[]; historyComplete: boolean; report: RunReport }[];
    skipped: PushSelection['skipped'];
    exitCode: number;
};

/** The selected index paths when present, and the count of unstaged changes. */
export type StagedSelection = StagedPaths | { staged: undefined; unstaged: number };

export type Selections = {
    paths: string[] | undefined;
    changed: ChangedPaths | undefined;
    staging: StagedSelection;
    stage: StageFilter;
};

/** The flags of check, as commander parses them. */
export type CheckFlags = {
    only?: string[];
    staged?: true;
    changed?: true;
    base: string;
    fix?: true;
    dryRun?: true;
    hook?: 'pre-commit' | 'pre-push' | 'commit-msg';
    skip: string[];
    messageFile?: string;
};

export type CheckOptions = {
    hook?: CheckFlags['hook'];
    onResult?: (result: CheckResult) => void;
    cwd: string;
    only?: string[];
    paths: string[];
    staged: boolean;
    push?: PushInput;
    changed?: string;
    fix: boolean;
    isDryRun: boolean;
    stage?: StageFilter;
    skips: string[];
    messageFile?: string;
    verbosity: OutputOptions['verbosity'];
};

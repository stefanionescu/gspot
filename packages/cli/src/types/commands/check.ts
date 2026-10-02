// The types of commands/check in this package.
import type { CommandResult } from '#cli/types/commands/commands.ts';
import type { RunReport, CheckResult, StageFilter } from '#cli/types/execution/execution.ts';
import type { StagedPaths, ChangedPaths, PushSelection } from '#cli/types/repository/revisions.ts';

export type PushRevision = PushSelection['revisions'][number];
export type Checked = PushReport['revisions'][number];
export type Selections = {
    paths: string[];
    changed: ChangedPaths | undefined;
    set: StagedPaths | { staged: undefined; unstaged: number };
    stage: StageFilter;
};

/** What a snapshot stands for: the staged index or a pushed commit, and the repository whose tools it runs. */
export type Revision = {
    commits?: string[];
    historyComplete?: boolean;
    content: 'index' | 'commit';
    installedRoot: string;
    reference: string;
    reportRoot?: string;
    staged?: StagedPaths;
    changed?: string[];
};
/** The flags of check, as commander parses them. */
export type CheckFlags = {
    only?: string[];
    push?: true;
    staged?: true;
    changed?: string | true;
    fix?: true;
    dryRun?: true;
    hook?: 'commit' | 'push';
    skip?: string[];
    messageFile?: string;
};
export type CheckOptions = {
    onResult?: (result: CheckResult) => void;
    cwd: string;
    only?: string[];
    paths: string[];
    staged: boolean;
    push?: { input: string; remote?: string };
    changed?: string;
    fix: boolean;
    isDryRun: boolean;
    stage?: StageFilter;
    skips: string[];
    messageFile?: string;
    quiet: boolean;
    verbose: boolean;
};
export type CheckCommandResult = CommandResult & { report?: RunReport };

/** The push report: one run report for every distinct tree that Git's pre-push input names. */
export type PushReport = {
    canceled?: { pendingRefs: string[] };
    revisions: { object: string; refs: string[]; commits: string[]; historyComplete: boolean; report: RunReport }[];
    skipped: { ref: string; object: string; reason: 'deleted ref' | 'non-commit object' }[];
    exitCode: number;
};

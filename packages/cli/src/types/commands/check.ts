// The types of commands/check in this package.
import type { CheckResult } from '#cli/types/checks/checks.ts';
import type { CommandResult } from '#cli/types/commands/commands.ts';
import type { PushReport, RunReport, StageFilter } from '#cli/types/execution/execution.ts';
import type { ChangedSet, PushSelection, StagedSet } from '#cli/types/repository/revisions.ts';

export type PushedRevision = PushSelection['revisions'][number];
export type Checked = PushReport['revisions'][number];
export type Selections = {
    changed: ChangedSet | undefined;
    set: StagedSet | { staged: undefined; unstaged: number };
    stage: StageFilter;
};
/** What a snapshot stands for: the staged index or a pushed commit, and where its report goes. */
export type Revision = {
    commits?: string[];
    historyComplete?: boolean;
    content: 'index' | 'commit';
    cacheRoot: string;
    reference: string;
    reportRoot?: string;
    staged?: StagedSet;
    changed?: string[];
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
    noCache: boolean;
};
export type CheckCommandResult = CommandResult & { report?: RunReport };

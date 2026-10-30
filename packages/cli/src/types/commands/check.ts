import { type CheckResult } from '#cli/types/runs/check.ts';
import { type HookName } from '#cli/types/generation/files.ts';
import { type IgnoreRecord } from '#cli/types/settings/file.ts';
import { type CanceledCommandJson } from '#cli/types/terminal.ts';
import { type Session, type CheckSession } from '#cli/types/session.ts';
import { type PlanOptions, type StageFilter, type PlannedCheck } from '#cli/types/planning.ts';
import { type StagedPaths, type ChangedPaths, type PushedRevisions } from '#cli/types/repository/revisions.ts';

type CheckedRevision = { hash: string; refs: string[]; commits: string[]; shallow: boolean; report: RunReport };

export type PushReport = {
    canceled?: { pendingRefs: string[] };
    revisions: CheckedRevision[];
    skipped: PushedRevisions['skipped'];
    exitCode: number;
};

export type RunFilters = {
    paths: string[] | undefined;
    changed: ChangedPaths | undefined;
    staging: StagedPaths | { staged: undefined; unstaged: number };
    stage: StageFilter;
};

export type CheckOptions = {
    allFiles?: 'empty-base' | 'new-branch';
    hook?: HookName;
    onProgress?: (progress: CheckProgress) => void;
    cwd: string;
    only?: string[];
    paths: string[];
    staged: boolean;
    push?: PushInput;
    base?: string;
    fix: boolean;
    dryRun: boolean;
    stage?: StageFilter;
    messageFile?: string;
    verbose: boolean;
};

export type RevisionSource = (
    | {
          content: 'index';
          cwd: string;
          paths: string[];
          toolsRoot: string;
          reference: string;
          reportRoot: string;
          staged: StagedPaths;
          started: Date;
      }
    | {
          content: 'commit';
          toolsRoot: string;
          reference: string;
          base?: string;
          commits: string[];
          range?: string[];
          shallow: boolean;
          changed?: string[];
      }
) & { dependencyNote?: string; unreadablePaths?: string[] };

export type CheckFlags = {
    json?: boolean;
    only?: string[];
    staged?: boolean;
    changed?: boolean | string;
    fix?: boolean;
    dryRun?: boolean;
    hook?: HookName;
    verbose?: boolean;
};

export type CheckCommandJson = RunReport | PushReport | CanceledCommandJson;

export type FinishedRun = {
    session: Session;
    options: RunOptions;
    started: Date;
    planned: PlannedCheck[];
    active: PlannedCheck[];
    results: CheckResult[];
    fixes: FixReport | undefined;
};

export type ReproduceOptions = {
    paths: string[];
    changed: string | undefined;
    messageFile: string | undefined;
    staged: boolean;
};

export type PathBytes = Map<string, Buffer | undefined>;

export type FixRounds = { results: FixResult[]; before: PathBytes; after: PathBytes };

type PushInput = { stdin: string; remote?: string };

export type FixReport = { results: FixResult[]; changed: string[]; broken: string[]; diffs: string[] };

export type FixResult = { check: string; changed: string[] } & (
    | { status: 'changed' | 'unchanged' | 'skipped' }
    | { status: 'failed' | 'canceled'; note: string }
);

export type CheckProgress = { finished: number; total: number; comparison: RunReport['comparison'] };

export type PlanAfterFixes = { session: CheckSession; planned: PlannedCheck[]; fixes: FixReport | undefined };

export type Run = {
    session: CheckSession;
    options: RunOptions;
};

export type RunOptions = PlanOptions & {
    started?: Date;
    stage: StageFilter;
    onProgress?: (progress: CheckProgress) => void;
    dryRun: boolean;
    comparison?: NonNullable<RunReport['comparison']>;
    unstagedChanges?: number;
    cwd: string;
    pathArguments: string[];
    push?: PushInput | undefined;
    fix: boolean;
    verbose?: boolean;
};

export type RunReport = {
    notChecked?: { configuration: string; evidence: string }[];
    notes?: string[];
    comparison?: { content: 'working-tree' | 'index' | 'commit'; reference: string };
    version: string;
    stage: StageFilter;
    started: string;
    duration: number;
    checks: readonly CheckResult[];
    ignores: readonly IgnoreRecord[];
    unstagedChanges: number;
    partial: boolean;
    failed: readonly string[];
    exitCode: number;
};

export type RunResult = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };

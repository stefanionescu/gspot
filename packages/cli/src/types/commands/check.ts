import type { Session } from '#cli/types/session.ts';
import type { CheckResult } from '#cli/types/runs/check.ts';
import type { HookName } from '#cli/types/generation/files.ts';
import type { CanceledCommandJson } from '#cli/types/terminal.ts';
import type { FixReport, FixResult } from '#cli/types/runs/fixes.ts';
import type { StageFilter, PlannedCheck } from '#cli/types/planning.ts';
import type { RunReport, RunOptions, CheckProgress } from '#cli/types/runs/run.ts';
import type { PushInput, StagedPaths, ChangedPaths, PushedRevisions } from '#cli/types/repository/revisions.ts';

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
    isDryRun: boolean;
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
      }
    | {
          content: 'commit';
          toolsRoot: string;
          reference: string;
          base?: string;
          commits: string[];
          shallow: boolean;
          changed?: string[];
      }
) & { dependencyNote?: string };

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
    ran: CheckResult[];
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

import type { StageFilter } from '#cli/types/planning.ts';
import type { CanceledCommandJson } from '#cli/types/terminal.ts';
import type { CHECK_HOOKS } from '#cli/config/generation/hooks.ts';
import type { RunReport, CheckProgress } from '#cli/types/runs/run.ts';
import type { PushInput, StagedPaths, ChangedPaths, PushedRevisions } from '#cli/types/repository/revisions.ts';

type CheckedRevision = { hash: string; refs: string[]; commits: string[]; historyComplete: boolean; report: RunReport };

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
    hook?: (typeof CHECK_HOOKS)[number];
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

export type RevisionSource =
    | {
          content: 'index';
          installedRoot: string;
          reference: string;
          reportRoot: string;
          staged: StagedPaths;
      }
    | {
          content: 'commit';
          installedRoot: string;
          reference: string;
          base?: string;
          commits: string[];
          historyComplete: boolean;
          changed?: string[];
      };

export type CheckFlags = {
    json?: boolean;
    only?: string[];
    staged?: boolean;
    changed?: boolean | string;
    fix?: boolean;
    dryRun?: boolean;
    hook?: (typeof CHECK_HOOKS)[number];
    verbose?: boolean;
};

export type CheckCommandJson = RunReport | PushReport | CanceledCommandJson;

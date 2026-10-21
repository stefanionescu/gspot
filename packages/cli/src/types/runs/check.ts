import type { CHECK_STATUSES } from '#cli/config/runs/run.ts';
import type { IgnoreRecord } from '#cli/types/settings/file.ts';
import type { PushInput } from '#cli/types/repository/revisions.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import type { Session, SkipCause, PlanOptions, StageFilter, PlannedCheck } from '#cli/types/planning.ts';

type RunReportOptions = PlanOptions & {
    stage: StageFilter;
    onResult?: (result: CheckResult, progress: CheckProgress) => void;
    isDryRun: boolean;
    comparison?: NonNullable<RunReport['comparison']>;
    /** Working-tree changes omitted when this run reads staged content. */
    unstagedChanges?: number;
};

/** The completion status of a check. */
type CheckStatus = (typeof CHECK_STATUSES)[number];

type CheckRun = (
    session: Session,
    planned: PlannedCheck,
    options?: CheckRunOptions,
) => CheckResult | Promise<CheckResult>;

/** Execution callbacks, keyed by the declared check ID. */
/** The code of one check: a built-in check or its own run, and the arguments and tool files of a tool check. */
export type CheckImplementation = ({ check: BuiltInCheck; run?: never } | { run?: CheckRun; check?: never }) &
    Pick<CheckRunOptions, 'arguments' | 'toolFiles'>;

export type CheckImplementations = Record<string, CheckImplementation>;

/** Finds the check implementation of a check; the run engine takes it as an input, because checks/ holds the code. */
export type SelectImplementation = (check: CheckDeclaration) => CheckImplementation | undefined;

export type FixResult = { check: string; changed: string[] } & (
    | { status: 'changed' | 'unchanged' | 'skipped' }
    | { status: 'failed'; note: string }
);

export type FixReport = { results: FixResult[]; changed: string[]; broken: string[]; diffs: string[] };

/** The command or scratch root that a check gives. */
export type CheckRunOptions = {
    command?: string[];
    scratchRoot?: string;
    arguments?: ((session: Session, planned: PlannedCheck) => string[]) | undefined;
    toolFiles?: ((session: Session, planned: PlannedCheck) => string[]) | undefined;
};

export type RunState = {
    session: Session;
    options: RunOptions;
};

export type RunOptions = RunReportOptions & {
    push?: PushInput | undefined;
    fix: boolean;
    selectImplementation: SelectImplementation;
};

export type RunResult = { report: RunReport; planned: PlannedCheck[]; fixes?: FixReport };

export type BuiltInCheckResult = { findings: Finding[]; files: string[] };

export type BuiltInCheck = (
    session: Session,
    planned: PlannedCheck,
) => Finding[] | BuiltInCheckResult | Promise<Finding[] | BuiltInCheckResult>;

export type CheckResult = {
    check: string;
    scope: string;
    status: CheckStatus;
    fileCount: number;
    files?: readonly string[];
    duration: number;
    findings: readonly Finding[];
    note?: string;
    cause?: SkipCause | 'inputs';
    reproduce?: string;
    command?: readonly string[];
};

/** The run report as check --json prints it. */
export type RunReport = {
    comparison?: { content: 'working-tree' | 'index' | 'commit'; reference: string };
    version: string;
    stage: StageFilter;
    started: string;
    duration: number;
    checks: readonly CheckResult[];
    ignores: readonly {
        check?: string;
        rule?: string;
        paths?: readonly string[];
        names?: readonly string[];
        reason: string;
    }[];
    /** How many changed files the run left out: the unstaged ones when it read the index. */
    unstagedChanges: number;
    /** Whether the run read only part of the repository: the staged files, a change set, or named paths. */
    partial: boolean;
    /** The checks that failed, with the checks whose fixer failed although the check passed. */
    failed: readonly string[];
    exitCode: number;
};

export type ReportInput = {
    session: Session;
    options: RunReportOptions;
    started: Date;
    planned: PlannedCheck[];
    active: PlannedCheck[];
    ran: CheckResult[];
    ignores: IgnoreRecord[];
    fixes: FixReport | undefined;
};

/** The checks and fixer results for the run after the fixes. */
export type PlanAfterFixes = { planned: PlannedCheck[]; fixes: FixReport | undefined };

/** A preview fixes a scratch copy and reports differences. */
export type FixOptions = { isDryRun: boolean; selectImplementation: SelectImplementation };

export type ReproduceOptions = {
    push: PushInput | undefined;
    messageFile: string | undefined;
    staged: boolean;
};

export type Finding = {
    check: string;
    file: string;
    message: string;
    fixable: boolean;
    line?: number | undefined;
    column?: number;
    rule?: string;
    help?: string;
    name?: string;
};

/** Where a finding points: the file, and the line and column when the check knows them. */
export type FindingPlace = Pick<Finding, 'file' | 'line' | 'column'>;

/** The finished check count and the comparison, for terminal progress. */
export type CheckProgress = { completed: number; total: number; comparison: RunReport['comparison'] };

import type { Session } from '#cli/types/session.ts';
import type { CHECK_STATUSES } from '#cli/config/runs/run.ts';
import type { SkipCause, PlannedCheck } from '#cli/types/planning.ts';

/** The completion status of a check. */
type CheckStatus = (typeof CHECK_STATUSES)[number];

/** The code of one check: a built-in check or its own run, and the arguments and tool files of a tool check. */
export type CheckCode = ({ check: BuiltInCheck; run?: never } | { run?: CheckRun; check?: never }) &
    Pick<CheckRunOptions, 'listFileArguments' | 'listToolFiles'>;

type CheckRun = (
    session: Session,
    planned: PlannedCheck,
    options?: CheckRunOptions,
) => CheckResult | Promise<CheckResult>;

/** The command or copy root that a check gives. */
export type CheckRunOptions = {
    command?: string[];
    copyRoot?: string;
    listFileArguments?: ((session: Session, planned: PlannedCheck) => string[]) | undefined;
    listToolFiles?: ((session: Session, planned: PlannedCheck) => string[]) | undefined;
};

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

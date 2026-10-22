import type { Session } from '#cli/types/session.ts';
import type { CHECK_STATUSES } from '#cli/config/runs/check.ts';
import type { SkipCause, PlannedCheck } from '#cli/types/planning.ts';

type CheckStatus = (typeof CHECK_STATUSES)[number];

/**
 * The code of one check: a built-in check or its own run, or the arguments and config files of a check that runs its
 * declared command.
 */
export type CheckCode = ({ check: BuiltInCheck; run?: never } | { run?: CheckRun; check?: never }) &
    Pick<CheckRunOptions, 'listFileArguments' | 'listConfigFiles'>;

type CheckRun = (
    session: Session,
    planned: PlannedCheck,
    options?: CheckRunOptions,
) => CheckResult | Promise<CheckResult>;

/** The command, copy folder, file arguments, and config files that a check run takes. */
export type CheckRunOptions = {
    command?: string[];
    copyRoot?: string;
    listFileArguments?: ((session: Session, planned: PlannedCheck) => string[]) | undefined;
    listConfigFiles?: ((session: Session, planned: PlannedCheck) => string[]) | undefined;
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
    cause?: SkipCause | 'no-files';
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

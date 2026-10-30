import type { CHECK_STATUSES } from '#cli/config/runs/check.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import type { SkipCause, PlannedCheck } from '#cli/types/planning.ts';

type CheckStatus = (typeof CHECK_STATUSES)[number];

export type CheckCode = ({ check: BuiltInCheck; run?: never } | { run?: CheckRun; check?: never }) &
    Pick<CheckRunOptions, 'listFileArguments' | 'listConfigFiles'>;

type CheckRun = (
    session: CheckSession,
    planned: PlannedCheck,
    options?: CheckRunOptions,
) => CheckResult | Promise<CheckResult>;

export type CheckRunOptions = {
    verbose?: boolean | undefined;
    command?: string[];
    copyRoot?: string;
    listFileArguments?: ((session: Session, planned: PlannedCheck) => string[]) | undefined;
    listConfigFiles?: ((session: Session, planned: PlannedCheck) => string[]) | undefined;
};

export type BuiltInCheckResult = { findings: CheckFinding[]; files: string[] };

export type BuiltInCheck = (
    session: CheckSession,
    planned: PlannedCheck,
) => CheckFinding[] | BuiltInCheckResult | Promise<CheckFinding[] | BuiltInCheckResult>;

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
};

export type FindingPlace = Pick<Finding, 'file' | 'line' | 'column'>;

export type CheckFinding = Omit<Finding, 'check' | 'fixable'>;

// One location and one message from one check, and the verdict of one check run.

export type Finding = {
    check: string;
    engine?: string;
    file: string;
    line?: number;
    column?: number;
    rule?: string;
    message: string;
    help?: string;
    fixable: boolean;
};

export type CheckStatus = 'ok' | 'fail' | 'cache' | 'missing' | 'skipped' | 'error';

export type CheckResult = {
    check: string;
    scope: string;
    status: CheckStatus;
    files: number;
    duration: number;
    findings: Finding[];
    note?: string;
    reproduce?: string;
    command?: string[];
    baselined: number;
};

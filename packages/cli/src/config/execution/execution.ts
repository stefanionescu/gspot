// The literal values execution reads: names, patterns, limits, and tables.

const TYPOS_FINDINGS = 2;

export const FIX_PASSES = 3;
export const FIX_DIFF_CONTEXT = 3;
export const RAN_STATUSES = new Set(['ok', 'fail']);

export const FAILED_STATUSES = new Set(['fail', 'missing', 'error']);
export const DOCKER = { name: 'docker', provider: 'host' as const, installers: {} };

export const POLICY_CHECK = 'integrity/policy';

/** Native structured reporters reserve these nonzero exit codes for findings. */
export const FINDING_EXIT_CODES = new Map<string | undefined, number[]>([
    ['typos', [TYPOS_FINDINGS]],
    ['markdownlint', [1]],
]);

/** The checks that read the history of the pushed commits. */
export const HISTORY_CHECKS = new Set(['commits/range', 'secrets/gitleaks', 'secrets/trufflehog']);

/** The check that compares the generated files with what the policy renders. */
export const GENERATED_DRIFT_CHECK = 'integrity/generated-drift';

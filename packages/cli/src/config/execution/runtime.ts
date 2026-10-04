import type { ToolPin } from '#cli/types/configurations.ts';
import type { CheckStatus } from '#cli/types/execution/runtime.ts';

export const FAILED_STATUSES = new Set<CheckStatus>(['failed', 'missing', 'error']);

export const TYPOS_FINDINGS = 2;

export const FIX_PASSES = 3;

export const FIX_DIFF_CONTEXT = 3;

/** Native structured reporters reserve these nonzero exit codes for findings. */
export const FINDING_EXIT_CODES = new Map<string | undefined, number[]>([
    ['typos', [TYPOS_FINDINGS]],
    ['markdownlint', [1]],
]);

export const RAN_STATUSES = new Set<CheckStatus>(['passed', 'failed']);

export const DOCKER: ToolPin = { name: 'docker', kind: 'binary', system: true, installers: {} };

/** The checks that read the history of the pushed commits. */
export const HISTORY_CHECKS = new Set(['commits/commitlint-range', 'secrets/gitleaks-history', 'secrets/trufflehog']);

/** The check that compares the generated files with what the policy renders. */
export const GENERATED_DRIFT_CHECK = 'gspot/drift';

export const POLICY_CHECK = 'gspot/policy';

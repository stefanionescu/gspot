// The types of checks/general/secrets in this package.
import type { Session } from '#cli/types/tools/tools.ts';
import type { PlannedCheck } from '#cli/types/execution/execution.ts';

export type SecretScan = { session: Session; planned: PlannedCheck; input: string };

export type BaselineReason = { fingerprint: string; reason: string };
export type GitleaksFinding = { Fingerprint: string; File: string; RuleID: string; Commit?: string };

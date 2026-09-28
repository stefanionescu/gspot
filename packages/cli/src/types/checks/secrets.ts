// The types of checks/secrets in this package.
import type { Session, PlannedCheck } from '#cli/types/execution/execution.ts';

export type SecretScan = { session: Session; planned: PlannedCheck; input: string };

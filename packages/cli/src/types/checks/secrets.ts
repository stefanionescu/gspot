// The types of checks/secrets in this package.
import type { PlannedCheck, Session } from '#cli/types/execution/execution.ts';

export type SecretScan = { session: Session; planned: PlannedCheck; input: string };

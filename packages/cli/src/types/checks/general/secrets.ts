import type { Session } from '#cli/types/execution/session.ts';

export type BaselineReason = { fingerprint: string; reason: string };

export type SecretScan = { session: Session; enumeratorFile: string };

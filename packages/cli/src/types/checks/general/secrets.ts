import type { ToolSession } from '#cli/types/tools/session.ts';

export type BaselineReason = { fingerprint: string; reason: string };

export type SecretScan = { session: ToolSession; enumeratorFile: string };

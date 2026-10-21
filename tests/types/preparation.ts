import type { PREPARED_SUITES } from '#tests/data/test-setup.ts';

export type PreparedSuite = (typeof PREPARED_SUITES)[number];

export type RuntimeSettings = { tools: { bun: string; node: string } };

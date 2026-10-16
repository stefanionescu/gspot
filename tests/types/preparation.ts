import type { PREPARED_SUITES } from '#tests/data/test-setup.ts';

export type PreparedSuite = (typeof PREPARED_SUITES)[number];

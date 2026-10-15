import type { PREPARED_SUITES } from '#tests/config/integration.ts';

export type PreparedSuite = (typeof PREPARED_SUITES)[number];

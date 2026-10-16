// Poll child exit and readiness markers within the shared test deadline.
export const EXIT_POLL_MS = 10;

export const READY_POLL_MS = 5;

// One deadline bounds each test and its child processes.
export const TEST_TIMEOUT_MS = 900_000;

export const GSPOT_ENVIRONMENT = { NO_COLOR: '1', CI: '1' } as const;

/** Seconds at process boundaries and milliseconds in the test deadline. */
export const MS_PER_SECOND = 1000;

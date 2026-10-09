// Poll child exit and readiness markers within the shared test deadline.
export const EXIT_POLL_MS = 10;
export const READY_POLL_MS = 5;

/** An owned child stops here before recovery observes its interrupted operation. */
export const INTERRUPTION_EXIT_CODE = 73;

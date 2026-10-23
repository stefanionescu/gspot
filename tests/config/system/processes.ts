/** The child timeout that the descendant test waits out. */
export const CHILD_TIMEOUT_SECONDS = 5;

/** The descendant test waits out the child timeout, so it needs more than the default test timeout of Bun. */
export const DESCENDANT_TIMEOUT_MILLISECONDS = 20_000;

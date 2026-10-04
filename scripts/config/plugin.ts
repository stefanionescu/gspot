export const PLUGIN_PUBLISH_TIMEOUT_MS = 60_000;

/** The complete startup, publication, and developer command budget. */
export const SOURCE_COMMAND_TIMEOUT_MS = 600_000;

export const INTERRUPTED_EXIT = 130;

export const TERMINATED_EXIT = 143;

/** A complete native suite can use ninety minutes across its individual test budgets. */
export const SOURCE_SUITE_TIMEOUT_MS = 5_400_000;

/** Each native test has fifteen minutes, including its subprocesses. */
export const NATIVE_TEST_TIMEOUT_MS = 900_000;

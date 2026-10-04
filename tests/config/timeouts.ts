// CLI and plugin tests have one minute; native tools and delivered packages have fifteen.

export const TEST_TIMEOUT_MS = 60_000;

/** How long a test-repository test may take: it spawns real tools. */
export const NATIVE_TEST_TIMEOUT_MS = 900_000;

export const DRIZZLE_DRIVERS = [
    { driver: 'pg', postgres: true },
    { driver: 'postgres', postgres: true },
    { driver: 'mysql2', postgres: false },
    { driver: 'better-sqlite3', postgres: false },
] as const;

/** Manual choices retain native dependency evidence independently of the test runner. */
export const PLAYWRIGHT_RUNNERS = [
    { runner: 'Jest', configurations: ['javascript', 'jest'] },
    { runner: 'Vitest', configurations: ['javascript', 'vitest'] },
    { runner: 'Bun', configurations: ['javascript'] },
    { runner: 'no test runner', configurations: ['javascript'] },
] as const;

export const PLAYWRIGHT_DEPENDENCIES = [
    { dependency: '@playwright/test', present: true },
    { dependency: 'playwright', present: true },
    { dependency: 'unrelated', present: false },
] as const;

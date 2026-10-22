/** A gspot version that no release has. Version pins and reports in the tests use it. */
export const TEST_VERSION = '0.0.0-test';

export const HOOKS_SETTINGS = '[hooks]\nenabled = true\n';
export const GSPOT_ENVIRONMENT = { NO_COLOR: '1', CI: '1' } as const;

/** Prints each path it gets, then fails. */
export const REPORT_SCRIPT = 'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;';

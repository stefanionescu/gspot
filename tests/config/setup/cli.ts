export const HOOKS_SETTINGS = '[hooks]\nenabled = true\n';

/** Prints each path it gets, then fails. */
export const REPORT_SCRIPT = 'process.argv.slice(1).forEach((path) => console.log(path)); process.exitCode = 1;';

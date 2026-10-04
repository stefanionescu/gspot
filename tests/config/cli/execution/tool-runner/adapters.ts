// A checker that passes, and one that fails.
export const PASSING_SCRIPT = `#!${process.execPath}\nprocess.exitCode = 0;\n`;

export const FAILING_SCRIPT = `#!${process.execPath}\nprocess.exitCode = 1;\n`;

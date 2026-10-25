import { join } from 'node:path';
import type { ProgramName } from '#tests/types/programs.ts';

/**
Build the arguments that run one of the test programs in tests/setup/programs, after the Bun executable.

@param name which file of tests/setup/programs to run.
@param programArguments what the program receives.
@returns the program path and its arguments.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function buildProgramArguments(name: ProgramName, ...programArguments: string[]): string[] {
    return [join(import.meta.dir, '..', 'programs', `${name}.ts`), ...programArguments];
}

/**
Build the command that runs one of the test programs in tests/setup/programs.

@param name which file of tests/setup/programs to run.
@param programArguments what the program receives.
@returns the command, with the running Bun executable first.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function buildProgramCommand(name: ProgramName, ...programArguments: string[]): string[] {
    return [process.execPath, ...buildProgramArguments(name, ...programArguments)];
}

/**
Split the arguments of a test program into its own options, before the first `--`, and the call it records or forwards.

@returns the own options and the call.
*/
export function splitProgramArguments(): { own: string[]; call: string[] } {
    const all = process.argv.slice(2);
    const separator = all.indexOf('--');
    return separator === -1 ? { own: all, call: [] } : { own: all.slice(0, separator), call: all.slice(separator + 1) };
}

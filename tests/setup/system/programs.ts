import { join } from 'node:path';
import type { ProgramName } from '#tests/types/programs.ts';

/**
Build the arguments that run one of the test programs in tests/setup/programs, after the Bun executable.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function buildProgramArguments(program: ProgramName, ...programArguments: string[]): string[] {
    return [join(import.meta.dir, '..', 'programs', `${program}.ts`), ...programArguments];
}

/**
Build the command that runs one of the test programs in tests/setup/programs with the running Bun executable.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function buildProgramCommand(program: ProgramName, ...programArguments: string[]): string[] {
    return [process.execPath, ...buildProgramArguments(program, ...programArguments)];
}

/**
Split the arguments of a test program into its own options, before the first `--`, and the call it records or forwards.
*/
export function splitProgramArguments(): { own: string[]; call: string[] } {
    const all = process.argv.slice(2);
    const separator = all.indexOf('--');
    return separator === -1 ? { own: all, call: [] } : { own: all.slice(0, separator), call: all.slice(separator + 1) };
}

import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { executableLayout } from '#cli/system/paths.ts';
import type { CallRecord, ProgramName } from '#tests/types/setup.ts';

/**
Build the command that runs one of the test programs in tests/setup/programs with the running Bun executable.
*/
export function buildProgramCommand(program: ProgramName, ...programArguments: string[]): string[] {
    return [process.execPath, join(import.meta.dir, '..', 'programs', `${program}.ts`), ...programArguments];
}

/**
Split a `name=value` argument of a test program at its first `=`.
*/
export function splitAssignment(pair: string): [string, string] {
    const separator = pair.indexOf('=');
    return [pair.slice(0, separator), pair.slice(separator + 1)];
}

/**
Read the calls that fakes/tool recorded with `--record`, oldest first.
*/

export async function readCallRecords(log: string): Promise<CallRecord[]> {
    const text = await readFile(log, 'utf8');
    return text
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as CallRecord);
}

/**
Split the arguments of a test program into its own options, before the first `--`, and the call it records or forwards.
*/
export function splitProgramArguments(): { own: string[]; call: string[] } {
    const all = process.argv.slice(2);
    const separator = all.indexOf('--');
    return separator === -1 ? { own: all, call: [] } : { own: all.slice(0, separator), call: all.slice(separator + 1) };
}

/**
Locate a console script inside a test's Python environment.

@param folder the environment root.
@param name the console script.
*/
export function buildVenvExecutablePath(folder: string, name: string): string {
    return join(folder, executableLayout.environmentFolder, name + executableLayout.environmentSuffix);
}

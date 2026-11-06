import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { executableLayout } from '#cli/system/paths.ts';
import type { CallRecord, ProgramName } from '#tests/types/setup.ts';

export function buildProgramCommand(program: ProgramName, ...programArguments: string[]): string[] {
    return [process.execPath, join(import.meta.dir, '..', 'programs', `${program}.ts`), ...programArguments];
}

export function splitAssignment(pair: string): [string, string] {
    const separator = pair.indexOf('=');
    return [pair.slice(0, separator), pair.slice(separator + 1)];
}

export async function readCallRecords(log: string): Promise<CallRecord[]> {
    const text = await readFile(log, 'utf8');
    return text
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as CallRecord);
}

export function splitProgramArguments(): { own: string[]; call: string[] } {
    const all = process.argv.slice(2);
    const separator = all.indexOf('--');
    return separator === -1 ? { own: all, call: [] } : { own: all.slice(0, separator), call: all.slice(separator + 1) };
}

export function buildVenvExecutablePath(folder: string, name: string): string {
    return join(folder, executableLayout.environmentFolder, name + executableLayout.environmentSuffix);
}

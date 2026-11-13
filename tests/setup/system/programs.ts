import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { EXECUTABLE_FILE } from '#cli/config/system.ts';
import { quoteArgument } from '#cli/system/text/quoting.ts';
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

export async function writeLauncher(target: string, command: readonly string[]): Promise<void> {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `#!/bin/sh\nexec ${command.map((word) => quoteArgument(word)).join(' ')} "$@"\n`);
    const windowsCommand = command.map((word) => `"${word.replaceAll('"', '""').replaceAll('%', '%%')}"`);
    await writeFile(`${target}.cmd`, `@echo off\r\n${windowsCommand.join(' ')} %*\r\n`);
    await chmod(target, EXECUTABLE_FILE);
}

export async function writeProgramCommand(
    folder: string,
    path: string,
    program: ProgramName,
    ...programArguments: string[]
): Promise<string> {
    const target = join(folder, path);
    await writeLauncher(target, buildProgramCommand(program, ...programArguments));
    return dirname(target);
}

import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CommandLine, Substitutions } from '#cli/types/runs/command.ts';
import { expandCommand, buildFileCommandLines } from '#cli/runs/command/placeholders.ts';

import {
    UNIX_COMMAND_LIMIT,
    WINDOWS_COMMAND_LIMIT,
    WINDOWS_ESCAPE_EXPANSION,
    WINDOWS_ARGUMENT_OVERHEAD,
} from '#cli/config/runs/command/batches.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function measureArgumentSize(argument: string, platform: NodeJS.Platform): number {
    return platform === 'win32'
        ? argument.length * WINDOWS_ESCAPE_EXPANSION + WINDOWS_ARGUMENT_OVERHEAD
        : Buffer.byteLength(argument) + 1;
}

/**
Splits a command into command lines that fit the system argument limit.

@param planned the check to run.
@param expansion what to run.
@param expansion.session the repository and its tools.
@param expansion.command the resolved executable path and authored arguments.
@param expansion.substitutions the file paths and placeholder values.
@returns the runs, in order.
*/
export function buildCommandLines(
    planned: PlannedCheck,
    expansion: { session: Session; command: string[]; substitutions: Substitutions },
): CommandLine[] {
    const { session, command, substitutions } = expansion;
    const fixed = expandCommand(session, planned, command, { ...substitutions, files: [] });
    return splitFileArguments(
        substitutions.files,
        fixed.filter((argument) => typeof argument === 'string'),
        process.platform,
    ).flatMap((files) =>
        buildFileCommandLines(expandCommand(session, planned, command, { ...substitutions, files }), files),
    );
}

/**
Splits file arguments while reserving space for the executable and fixed arguments.

@param files the paths to split.
@param fixed the executable and arguments outside the file list.
@param platform the system that runs the command.
@returns the batches, in order.
*/
export function splitFileArguments(files: string[], fixed: string[], platform: NodeJS.Platform): string[][] {
    const limit = platform === 'win32' ? WINDOWS_COMMAND_LIMIT : UNIX_COMMAND_LIMIT;
    const budget = limit - fixed.reduce((size, argument) => size + measureArgumentSize(argument, platform), 0);
    if (budget < 0) throw new Error('Tool arguments exceed the command limit. Shorten the tool arguments.');
    const batches: string[][] = [[]];
    let used = 0;
    for (const file of files) {
        const size = measureArgumentSize(file, platform);
        if (size > budget) throw new Error(`${file} is too long for one command line. Shorten its path.`);
        const last = batches.at(-1) as string[];
        if (used + size > budget) {
            batches.push([file]);
            used = size;
        } else {
            last.push(file);
            used += size;
        }
    }
    return batches;
}

import type { PlannedCheck } from '#cli/types/planning.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { Substitutions, CommandInvocation } from '#cli/types/execution/command.ts';
import { substitute, perFileCommands } from '#cli/execution/command/arguments/public.ts';

import {
    UNIX_COMMAND_LIMIT,
    WINDOWS_COMMAND_LIMIT,
    WINDOWS_ESCAPE_EXPANSION,
    WINDOWS_ARGUMENT_OVERHEAD,
} from '#cli/config/execution/command.ts';

function argumentSize(argument: string, platform: NodeJS.Platform): number {
    return platform === 'win32'
        ? argument.length * WINDOWS_ESCAPE_EXPANSION + WINDOWS_ARGUMENT_OVERHEAD
        : Buffer.byteLength(argument) + 1;
}

/**
 * Fit command invocations within the argument budget.
 * @param session the session
 * @param planned the check
 * @param command the authored arguments
 * @param substitutions the files and values
 * @param toolPath the executable path
 * @returns ordered invocations
 */
export function batchedCommands(
    session: ToolSession,
    planned: PlannedCheck,
    command: string[],
    substitutions: Substitutions,
    toolPath: string | undefined,
): CommandInvocation[] {
    const fixed = substitute(session, planned, command, { ...substitutions, files: [] });
    if (toolPath !== undefined) fixed[0] = toolPath;
    return fileBatches(
        substitutions.files,
        fixed.filter((part) => typeof part === 'string'),
        process.platform,
    ).flatMap((files) => {
        const argv = substitute(session, planned, command, { ...substitutions, files });
        if (toolPath !== undefined) argv[0] = toolPath;
        return perFileCommands(argv, files);
    });
}

/**
 * Splits file arguments while reserving space for the executable and fixed arguments.
 * @param files the file paths
 * @param fixed the executable and arguments outside the file list
 * @param platform the platform that executes the command
 * @returns the batches, in order
 */
export function fileBatches(files: string[], fixed: string[], platform: NodeJS.Platform): string[][] {
    // Reserve space below cmd.exe's 8191-character limit for the npm wrapper.
    const limit = platform === 'win32' ? WINDOWS_COMMAND_LIMIT : UNIX_COMMAND_LIMIT;
    const budget = limit - fixed.reduce((size, argument) => size + argumentSize(argument, platform), 0);
    if (budget < 0) throw new Error('Tool arguments exceed the command limit. Shorten the tool configuration.');
    const batches: string[][] = [[]];
    let used = 0;
    for (const file of files) {
        const size = argumentSize(file, platform);
        if (size > budget) throw new Error(`${file} is too long for one command line. Shorten its path.`);
        const current = batches.at(-1) as string[];
        if (used + size > budget) {
            batches.push([file]);
            used = size;
        } else {
            current.push(file);
            used += size;
        }
    }
    return batches;
}

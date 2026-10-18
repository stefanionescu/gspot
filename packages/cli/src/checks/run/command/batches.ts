import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import type { Substitutions, CommandInvocation } from '#cli/types/checks/run/command.ts';
import { expandToolCommand, buildFileInvocations } from '#cli/checks/run/command/placeholders.ts';

import {
    UNIX_COMMAND_LIMIT,
    WINDOWS_COMMAND_LIMIT,
    WINDOWS_ESCAPE_EXPANSION,
    WINDOWS_ARGUMENT_OVERHEAD,
} from '#cli/config/checks/run/command.ts';

function computeArgumentSize(argument: string, platform: NodeJS.Platform): number {
    return platform === 'win32'
        ? argument.length * WINDOWS_ESCAPE_EXPANSION + WINDOWS_ARGUMENT_OVERHEAD
        : Buffer.byteLength(argument) + 1;
}

/**
 * Splits a command into runs that fit the system argument limit.
 * @param planned the check to run.
 * @param invocation what to run.
 * @param invocation.session the repository and its tools.
 * @param invocation.command the executable and authored arguments.
 * @param invocation.substitutions the file paths and placeholder values.
 * @param invocation.toolPath the resolved executable path.
 * @returns the runs, in order.
 */
export function buildInvocations(
    planned: PlannedCheck,
    invocation: { session: Session; command: string[]; substitutions: Substitutions; toolPath: string },
): CommandInvocation[] {
    const { session, command, substitutions, toolPath } = invocation;
    const fixed = expandToolCommand(session, planned, command, {
        substitutions: { ...substitutions, files: [] },
        toolPath,
    });
    return splitFileArguments(
        substitutions.files,
        fixed.filter((part) => typeof part === 'string'),
        process.platform,
    ).flatMap((files) => {
        const commandArguments = expandToolCommand(session, planned, command, {
            substitutions: { ...substitutions, files },
            toolPath,
        });
        return buildFileInvocations(commandArguments, files);
    });
}

/**
 * Splits file arguments while reserving space for the executable and fixed arguments.
 * @param files the paths to split.
 * @param fixed the executable and arguments outside the file list.
 * @param platform the system that runs the command.
 * @returns the batches, in order.
 */
export function splitFileArguments(files: string[], fixed: string[], platform: NodeJS.Platform): string[][] {
    // Reserve space below the 8191-character limit of cmd.exe for the npm wrapper.
    const limit = platform === 'win32' ? WINDOWS_COMMAND_LIMIT : UNIX_COMMAND_LIMIT;
    const budget = limit - fixed.reduce((size, argument) => size + computeArgumentSize(argument, platform), 0);
    if (budget < 0) throw new Error('Tool arguments exceed the command limit. Shorten the tool arguments.');
    const batches: string[][] = [[]];
    let used = 0;
    for (const file of files) {
        const size = computeArgumentSize(file, platform);
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

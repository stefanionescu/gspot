// Batches file arguments within the process and npm wrapper command limits.
import {
    UNIX_COMMAND_LIMIT,
    WINDOWS_COMMAND_LIMIT,
    WINDOWS_ESCAPE_EXPANSION,
    WINDOWS_ARGUMENT_OVERHEAD,
} from '#cli/constants/execution/execution.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Its callers sit at the complexity or length limit; inlining the expression pushes them over.
function argumentSize(argument: string, platform: NodeJS.Platform): number {
    return platform === 'win32'
        ? argument.length * WINDOWS_ESCAPE_EXPANSION + WINDOWS_ARGUMENT_OVERHEAD
        : Buffer.byteLength(argument) + 1;
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
        if (size > budget) throw new Error('A file argument exceeds the command limit. Shorten the file path.');
        const current = batches.at(-1) ?? [];
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

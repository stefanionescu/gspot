// Batches file arguments within the process and npm wrapper command limits.

const WINDOWS_COMMAND_LIMIT = 7000;
const UNIX_COMMAND_LIMIT = 100_000;
const WINDOWS_ESCAPE_EXPANSION = 5;
const WINDOWS_ARGUMENT_OVERHEAD = 9;

function argumentSize(argument: string, platform: NodeJS.Platform): number {
    // cross-spawn quotes and double-escapes npm shim arguments. Five characters per
    // UTF-16 unit plus quoted boundaries bounds that expansion, including backslashes.
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

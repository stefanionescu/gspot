// Reads the executable basename from a shebang without retaining interpreter arguments.
import { posix } from 'node:path';
import { ENV_EXECUTABLE_SUFFIX } from '#cli/config/parsers/source.ts';

/**
 * Read the first executable, skipping env and its -S argument when present.
 * @param firstLine the first source line
 * @returns the executable basename, or undefined without an executable shebang
 */
export function parseShebang(firstLine: string): string | undefined {
    if (!firstLine.startsWith('#!')) return undefined;
    const tokens = firstLine.slice('#!'.length).trim().split(/\s+/u);
    let index = 0;
    if (tokens[index]?.endsWith(ENV_EXECUTABLE_SUFFIX) === true) index += 1;
    if (tokens[index] === '-S') index += 1;
    const word = tokens[index];
    return word === undefined || word === '' ? undefined : posix.basename(word);
}

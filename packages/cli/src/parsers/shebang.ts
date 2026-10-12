// Reads the executable basename from a shebang without retaining interpreter arguments.
// Identifies a script interpreter from its first line.
import { posix } from 'node:path';
import { ENV_SPLIT_FLAG, SHEBANG_PREFIX, ENV_EXECUTABLE_SUFFIX } from '#cli/config/parsers/shebang.ts';

/**
 * Read the first executable, skipping env and its -S argument when present.
 * @param firstLine the first source line.
 * @returns the executable basename, or undefined without an executable shebang.
 */
export function parseShebang(firstLine: string): string | undefined {
    if (!firstLine.startsWith(SHEBANG_PREFIX)) return undefined;
    const tokens = firstLine.slice(SHEBANG_PREFIX.length).trim().split(/\s+/u);
    let index = 0;
    if (tokens[index]?.endsWith(ENV_EXECUTABLE_SUFFIX) === true) index += 1;
    if (tokens[index] === ENV_SPLIT_FLAG) index += 1;
    const word = tokens[index];
    return word === undefined || word === '' ? undefined : posix.basename(word);
}

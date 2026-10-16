// Identifies repository files, generated notices, and script interpreters.
import { posix } from 'node:path';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { Lockfile } from '#cli/types/parsers/lockfiles.ts';
import { HEADER_LINES_CHECKED, GENERATED_HEADER_LINE } from '#cli/config/generation/header.ts';
import { ENV_SPLIT_FLAG, SHEBANG_PREFIX, ENV_EXECUTABLE_SUFFIX } from '#cli/config/parsers/shebang.ts';

/**
 * Detect the generated gspot marker in the opening comment lines.
 * @param text a file's opening text.
 * @returns whether the text carries the generated marker.
 */
export function hasGeneratedHeader(text: string): boolean {
    const lines = text.split('\n', HEADER_LINES_CHECKED);
    return lines.some((line) => GENERATED_HEADER_LINE.test(line));
}

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

/**
 * Read the declared consumers of one repository lockfile.
 * @param path the repository-relative file.
 * @returns its metadata, or undefined for an unsupported filename.
 */
export function findLockfile(path: string): Lockfile | undefined {
    return LOCKFILES.find((entry) => entry.file === posix.basename(path));
}

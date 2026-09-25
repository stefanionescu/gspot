import { SHEBANG_INTERPRETERS } from '#cli/repository/patterns.ts';

const ENV_SUFFIX = '/env';

function withoutTrailingVersion(word: string): string {
    let end = word.length;
    while (end > 0 && '0123456789.'.includes(word[end - 1] ?? '')) end -= 1;
    return word.slice(0, end);
}

/**
 * Reads the executable token, including env -S and interpreter arguments.
 * @param firstLine the first line of the file
 * @returns the executable basename or undefined without a shebang
 */
export function shebangExecutable(firstLine: string): string | undefined {
    if (!firstLine.startsWith('#!')) return undefined;
    const tokens = firstLine.slice(2).trim().split(/\s+/u);
    let index = 0;
    if (tokens[index]?.endsWith(ENV_SUFFIX) === true) index += 1;
    if (tokens[index] === '-S') index += 1;
    const word = tokens[index];
    return word === undefined || word === '' ? undefined : word.slice(word.lastIndexOf('/') + 1);
}

/**
 * The interpreter a shebang names, or undefined.
 * @param firstLine the first line of the file
 * @returns the interpreter name the table knows
 */
export function shebangInterpreter(firstLine: string): string | undefined {
    const word = shebangExecutable(firstLine);
    if (word === undefined) return undefined;
    const stripped = withoutTrailingVersion(word);
    return SHEBANG_INTERPRETERS[word] ?? SHEBANG_INTERPRETERS[stripped];
}

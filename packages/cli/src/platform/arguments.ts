import { resolve } from 'node:path';
import { parseShell } from '@yarnpkg/parsers';
/**
 * Quote one argument for a POSIX shell command shown to the reader.
 * @param value the argument
 * @returns the argument, quoted when it needs to be
 */
export function quoteArgument(value: string): string {
    if (/^[a-zA-Z0-9_./-]+$/u.test(value)) return value;
    return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

/**
 * Read a configured executable and literal arguments, preserving shell quoting.
 * @param source the command line as written
 * @returns the executable and its arguments
 */
export function commandArguments(source: string): string[] {
    const lines = parseShell(source, { isGlobPattern: () => false });
    const line = lines[0];
    if (lines.length !== 1 || line?.type !== ';' || line.command.then !== undefined)
        throw new Error('Configure one executable with literal arguments.');
    const command = line.command.chain;
    if (command.type !== 'command' || command.then !== undefined || command.envs.length > 0)
        throw new Error('Configure one executable with literal arguments.');
    return command.args.map((argument) => {
        if (argument.type !== 'argument') throw new Error('Command redirection is not supported.');
        return argument.segments
            .map((segment) => {
                if (segment.type !== 'text') throw new Error('Command arguments must be literal values.');
                return segment.text;
            })
            .join('');
    });
}

/**
 * A text flag, undefined when absent or empty.
 * @param flags the parsed flags
 * @param name the camel-cased flag name
 * @returns the text
 */
export function textFlag(flags: Record<string, unknown>, name: string): string | undefined {
    const value = flags[name];
    return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * A list flag, undefined when absent or empty.
 * @param flags the parsed flags
 * @param name the camel-cased flag name
 * @returns the items
 */
export function listFlag(flags: Record<string, unknown>, name: string): string[] | undefined {
    const value = flags[name];
    return Array.isArray(value) && value.length > 0 ? value.map(String) : undefined;
}

/**
 * The directory the global -C flag names, or the working directory.
 * @param global the global flags
 * @returns the directory
 */
export function directoryOf(global: Record<string, unknown>): string {
    return resolve(textFlag(global, 'C') ?? process.cwd());
}

/**
 * A text flag as a single-key object when present, so it spreads into an options object with exact optional types.
 * @param flags the parsed flags
 * @param name the camel-cased flag name
 * @param key the option key to set
 * @returns the object, empty when the flag is absent
 */
export function textEntry<K extends string>(
    flags: Record<string, unknown>,
    name: string,
    key: K,
): { [P in K]?: string } {
    const value = textFlag(flags, name);
    return value === undefined ? {} : ({ [key]: value } as { [P in K]?: string });
}

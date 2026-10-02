// The flag readers the commands share: text, lists, the folder of -C, and optional entries.
import { resolve } from 'node:path';

/**
 * A text flag that returns undefined when absent or empty.
 * @param flags the parsed flags
 * @param name the camel-cased flag name
 * @returns the text
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Commands read a text flag the same way: absent and empty are both undefined.
export function textFlag(flags: Record<string, unknown>, name: string): string | undefined {
    const value = flags[name];
    return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * A list flag that returns undefined when absent or empty.
 * @param flags the parsed flags
 * @param name the camel-cased flag name
 * @returns the items
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Commands read a list flag the same way: absent and empty are both undefined.
export function listFlag(flags: Record<string, unknown>, name: string): string[] | undefined {
    const value = flags[name];
    return Array.isArray(value) && value.length > 0 ? value.map(String) : undefined;
}

/**
 * The directory the global -C flag names, or the working directory.
 * @param global the global flags
 * @returns the directory
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every command resolves the folder of the global -C flag the same way.
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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Commands spread an optional text flag into their options with exact optional types through this.
export function textEntry<K extends string>(
    flags: Record<string, unknown>,
    name: string,
    key: K,
): { [P in K]?: string } {
    const value = textFlag(flags, name);
    return value === undefined ? {} : ({ [key]: value } as { [P in K]?: string });
}

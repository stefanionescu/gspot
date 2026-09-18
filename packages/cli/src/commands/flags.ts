// The readers for the flag values commander hands over as unknown.

/**
 * A comma-separated flag value as a list, trimmed, empty items dropped.
 * @param value the flag text
 * @returns the items
 */
export function commaList(value: string): string[] {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item !== '');
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
    return textFlag(global, 'directory') ?? process.cwd();
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

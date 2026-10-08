// Shared normalization and key-path reads for parsed objects.
import type { Defined } from '#cli/types/platform/runtime.ts';

/**
 * Drops the undefined entries of an object, so exact optional types hold.
 * @param value any object
 * @returns the same object without its undefined entries
 */
export function compact<T extends object>(value: T): Defined<T> {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Defined<T>;
}

/**
 * Whether a parsed value is a plain object of named values: not null, not a list, and not a date.
 * @param value the value
 * @returns whether the value holds keys
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/**
 * Identify nonempty arrays of parsed tables for native section layout.
 * @param value a parsed value
 * @returns whether each array item is a plain table
 */
export function isRecordArray(value: unknown): value is Record<string, unknown>[] {
    return Array.isArray(value) && value.length > 0 && value.every(isRecord);
}

/**
 * The value at a key path inside a parsed object.
 * @param value the parsed object
 * @param keys the keys, outermost first
 * @returns the value, or undefined when any key along the path is absent
 */
export function valueAt(value: unknown, keys: readonly (string | number)[]): unknown {
    let current = value;
    for (const key of keys) {
        if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key)) return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}

/**
 * Give parsed objects a consistent null prototype while preserving dates and array order.
 * @param value a parsed or edited field
 * @returns the same values with consistent object prototypes
 */
export function normalizeTables(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => normalizeTables(entry));
    if (!isRecord(value)) return value;
    const table = Object.fromEntries<unknown>(
        Object.entries(value).map(([key, entry]) => [key, normalizeTables(entry)]),
    );
    Object.setPrototypeOf(table, null);
    return table;
}

/**
 * Creates the missing tables along a dotted path.
 * @param raw the parsed document.
 * @param path the table names from the root down.
 * @returns the table at the end of the path, or undefined when the path is missing or runs through a value.
 */
export function createTable(raw: Record<string, unknown>, path: string[]): Record<string, unknown> | undefined {
    let current = raw;
    for (const part of path) {
        let next = current[part];
        if (next === undefined) {
            next = {};
            current[part] = next;
        }
        if (!isRecord(next)) return undefined;
        current = next;
    }
    return current;
}

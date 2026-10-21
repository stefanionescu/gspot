// Reads and shapes plain values: records, nested keys, and tables.
import type { Defined } from '#cli/types/shapes.ts';

/**
 * Drop the undefined entries of an object, so exact optional types hold.
 *
 * @param value any object.
 *
 * @returns the same object without its undefined entries.
 */
export function stripUndefined<T extends object>(value: T): Defined<T> {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Defined<T>;
}

/**
 * Check whether a parsed value holds named fields without an array or date prototype.
 *
 * @param value the parsed input to distinguish from arrays, dates, and null.
 *
 * @returns whether the value holds keys.
 */
export function isTable(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/**
 * Read the value at a key path in a parsed object.
 *
 * @param value the parsed object.
 * @param keys the property names, outermost first.
 *
 * @returns the value, or undefined when any key along the path has no value.
 */
export function getValueAt(value: unknown, keys: readonly (string | number)[]): unknown {
    let current = value;
    for (const key of keys) {
        if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key)) return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}

/**
 * Give parsed objects a null prototype, and keep dates and array order.
 *
 * @param value a parsed or edited field.
 *
 * @returns the same values with null object prototypes.
 */
export function normalizeTables(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => normalizeTables(entry));
    if (!isTable(value)) return value;
    const table = Object.fromEntries<unknown>(
        Object.entries(value).map(([key, entry]) => [key, normalizeTables(entry)]),
    );
    Object.setPrototypeOf(table, null);
    return table;
}

/**
 * Create the missing tables along a dotted path.
 *
 * @param raw the parsed document.
 * @param path the table names from the root down.
 *
 * @returns the table at the end of the path, or undefined when the path runs through a missing or single value.
 */
export function createTable(
    raw: Record<string, unknown>,
    path: readonly string[],
): Record<string, unknown> | undefined {
    let current = raw;
    for (const part of path) {
        let next = current[part];
        if (next === undefined) {
            next = {};
            current[part] = next;
        }
        if (!isTable(next)) return undefined;
        current = next;
    }
    return current;
}

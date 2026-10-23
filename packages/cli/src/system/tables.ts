import type { Defined } from '#cli/types/shapes.ts';

/**
 * Drop the undefined entries of an object, so exact optional types hold.
 *
 * @param value any object.
 *
 * @returns the same object without its undefined entries.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 23 files call it.
export function stripUndefined<T extends object>(value: T): Defined<T> {
    return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as Defined<T>;
}

/**
 * Check whether a parsed value holds named fields without an array or date prototype.
 *
 * @param value the parsed value to tell apart from arrays, dates, and null.
 * @returns whether the value holds keys.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers narrow the type through it.
export function isTable(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/**
 * Get the value at a key path in a parsed object.
 *
 * @param value the parsed object.
 * @param keys the property names, outermost first.
 * @returns the value, or undefined when any key along the path has no value.
 */
export function getValueAt(value: unknown, keys: readonly (string | number)[]): unknown {
    let node = value;
    for (const key of keys) {
        if (node === null || typeof node !== 'object' || !Object.hasOwn(node, key)) return undefined;
        node = (node as Record<string, unknown>)[key];
    }
    return node;
}

/**
 * Give parsed objects a null prototype, and keep dates and array order.
 *
 * @param value a parsed or edited field.
 *
 * @returns the same values with null object prototypes.
 */
export function normalizeTables(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((element) => normalizeTables(element));
    if (!isTable(value)) return value;
    const table = Object.fromEntries<unknown>(
        Object.entries(value).map(([key, child]) => [key, normalizeTables(child)]),
    );
    Object.setPrototypeOf(table, null);
    return table;
}

/**
 * Create the missing tables along a dotted path.
 *
 * @param root the parsed document.
 * @param path the table names from the root down.
 * @returns the table at the end of the path, or undefined when the path runs through a value other than a table.
 */
export function createTable(
    root: Record<string, unknown>,
    path: readonly string[],
): Record<string, unknown> | undefined {
    let node = root;
    for (const segment of path) {
        let next = node[segment];
        if (next === undefined) {
            next = {};
            node[segment] = next;
        }
        if (!isTable(next)) return undefined;
        node = next;
    }
    return node;
}

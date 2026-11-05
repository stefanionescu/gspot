/**
Check whether a parsed value holds named fields without an array or date prototype.

@param value the parsed value to tell apart from arrays, dates, and null.
*/
export function isTable(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/**
Give an absent value the null that JSON keeps, so that a report holds the same keys in every run.

@param value the value, which can be absent.
*/
export function fillNull<Value>(value: Value | undefined): Value | null {
    return value ?? null;
}

/**
Get the value at a key path in a parsed object.

@param value the parsed object.
@param keys the property names, outermost first.
@returns undefined when any key along the path has no value.
*/
export function findValueAt(value: unknown, keys: ReadonlyArray<string | number>): unknown {
    let node = value;
    for (const key of keys) {
        if (node === null || typeof node !== 'object' || !Object.hasOwn(node, key)) return undefined;
        node = (node as Record<string, unknown>)[key];
    }
    return node;
}

/**
Give parsed objects a null prototype, and keep dates and array order.

@param value a parsed or edited field.
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
Create the missing tables along a dotted path.

@param document the parsed document.
@param keys the table names from the root down.
@returns undefined when the path runs through a value other than a table.
*/
export function addTable(
    document: Record<string, unknown>,
    keys: readonly string[],
): Record<string, unknown> | undefined {
    let node = document;
    for (const segment of keys) {
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

/**
Read a map entry that the code before this call put there.

@param map the entries.
@param key the entry to read.
@param label the kind of entry, for the message of the broken invariant.
*/
export function getRequired<Key, Value>(map: ReadonlyMap<Key, Value | undefined>, key: Key, label: string): Value {
    const value = map.get(key);
    if (value === undefined) throw new Error(`Missing ${label}: ${String(key)}.`);
    return value;
}

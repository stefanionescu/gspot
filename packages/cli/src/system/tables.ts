export function isTable(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

export function findValueAt(value: unknown, keys: ReadonlyArray<string | number>): unknown {
    let node = value;
    for (const key of keys) {
        if (node === null || typeof node !== 'object' || !Object.hasOwn(node, key)) return undefined;
        node = (node as Record<string, unknown>)[key];
    }
    return node;
}

export function normalizeTables(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((element) => normalizeTables(element));
    if (!isTable(value)) return value;
    const table = Object.fromEntries<unknown>(
        Object.entries(value).map(([key, child]) => [key, normalizeTables(child)]),
    );
    Object.setPrototypeOf(table, null);
    return table;
}

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

export function getRequired<Key, Value>(map: ReadonlyMap<Key, Value | undefined>, key: Key, label: string): Value {
    const value = map.get(key);
    if (value === undefined) throw new Error(`Missing ${label}: ${String(key)}.`);
    return value;
}

/**
Join the tables that the configurations export. Object spread lets the later of two equal keys replace the earlier one
in silence, so a repeated key stops the program here.
*/
export function joinTables<Entry>(
    tables: ReadonlyArray<Readonly<Record<string, Entry>>>,
): Readonly<Record<string, Entry>> {
    const entries = tables.flatMap((table) => Object.entries(table));
    const repeated = entries.map(([key]) => key).filter((key, index, keys) => keys.indexOf(key) !== index);
    if (repeated.length > 0) throw new Error(`Two registry tables hold ${repeated.join(', ')}.`);
    return Object.fromEntries(entries);
}

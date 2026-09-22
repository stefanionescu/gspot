// The one writer the six commands share: patch gspot.toml keeping comments and order, validate as load does, write.
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { patch } from '@decimalturn/toml-patch';
import { readFileSync } from 'node:fs';
import { assertPolicyComplete } from '#cli/policy/validate-policy.ts';
import type { TomlTable, Mutation, WriteResult } from '#cli/policy/types.ts';
import { parsePolicyText, policyPath, parseTomlText } from '#cli/policy/read-policy.ts';
import { stringify as stringifyToml } from 'smol-toml';

function isTable(value: unknown): value is TomlTable {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function splitKey(key: string): { path: string[]; name: string } {
    const path = key.split('.');
    const name = path.pop() ?? key;
    return { path, name };
}

function listItemKey(item: unknown): string {
    const isNamed = typeof item === 'object' && item !== null && 'name' in item;
    return JSON.stringify(isNamed ? (item as TomlTable)['name'] : item);
}

function tablesAlong(raw: TomlTable, path: string[]): TomlTable[] | undefined {
    const tables: TomlTable[] = [raw];
    for (const part of path) {
        const next = tables.at(-1)?.[part];
        if (!isTable(next)) return undefined;
        tables.push(next);
    }
    return tables;
}

function pruneEmpty(tables: TomlTable[], path: string[]): void {
    for (let index = tables.length - 1; index > 0; index -= 1) {
        const table = tables[index];
        const parent = tables[index - 1];
        const part = path[index - 1];
        if (table && parent && part !== undefined && Object.keys(table).length === 0)
            Reflect.deleteProperty(parent, part);
    }
}

/**
 * Walks a dotted path of tables, creating the missing ones when asked to.
 * @param raw the parsed document
 * @param path the table names from the root down
 * @param canCreate when true, missing tables are created on the way
 * @returns the table at the end of the path, or undefined when the path is missing or runs through a value
 */
export function tableAt(raw: TomlTable, path: string[], canCreate: boolean): TomlTable | undefined {
    let current: TomlTable = raw;
    for (const part of path) {
        let next = current[part];
        if (next === undefined) {
            if (!canCreate) return undefined;
            next = {};
            current[part] = next;
        }
        if (!isTable(next)) return undefined;
        current = next;
    }
    return current;
}

/**
 * Propose a policy mutation in memory and validate its resulting document.
 * @param root the repository root
 * @param mutate the change to apply to the parsed document
 * @param text the original policy text
 * @returns the new text, the parsed policy and whether the text changed
 */
export function proposePolicy(root: string, text: string, mutate: Mutation): WriteResult {
    const raw = parseTomlText(text, 'gspot.toml');
    const before = new Set(Object.keys(raw));
    mutate(raw);
    // toml-patch cannot add an array of tables that was not there; seed the text with it first.
    let seed = text;
    for (const [key, value] of Object.entries(raw))
        if (!before.has(key) && Array.isArray(value) && value.length > 0 && typeof value[0] === 'object')
            seed = `${seed.trimEnd()}\n\n${stringifyToml({ [key]: value })}`;
    // No padding inside array brackets: the style taplo formats to, so a hand edit and a written entry agree.
    const next = patch(seed, raw, { inlineTableStart: 2, bracketSpacing: false });
    const policy = parsePolicyText(next, 'gspot.toml', root);
    assertPolicyComplete(policy);
    return { text: next, policy, changed: next !== text };
}

/** Apply a validated policy proposal through lifecycle ownership. */
export function writePolicy(root: string, mutate: Mutation, isDryRun = false): WriteResult {
    const text = readFileSync(policyPath(root), 'utf8');
    const proposal = proposePolicy(root, text, mutate);
    if (proposal.changed && !isDryRun)
        withLifecycleOwner(root, (owner) => {
            const previous = owner.read('gspot.toml');
            if (previous?.bytes.toString('utf8') !== text)
                throw new Error('gspot.toml changed while the edit was prepared. Retry the command.');
            const status = owner.replace(
                'gspot.toml',
                { bytes: Buffer.from(proposal.text), mode: previous.mode },
                'policy',
                true,
            );
            if (status === 'preserved') throw new Error('The policy edit could not preserve the current input.');
        });
    return proposal;
}

/**
 * Appends an entry to an array of tables such as [[ignore]].
 * @param table the array's name
 * @param entry the table to append
 * @returns the mutation
 */
export function appendEntry(table: string, entry: TomlTable): Mutation {
    return (raw) => {
        const list = (raw[table] as TomlTable[] | undefined) ?? [];
        list.push(entry);
        raw[table] = list;
    };
}

/**
 * Removes every entry of an array of tables that the predicate matches, and counts them.
 * @param table the array's name
 * @param isMatch tells whether one entry goes
 * @param counter receives how many entries went
 * @param counter.removed the count, written by the mutation
 * @returns the mutation
 */
export function removeEntries(
    table: string,
    isMatch: (entry: TomlTable) => boolean,
    counter: { removed: number },
): Mutation {
    return (raw) => {
        const list = (raw[table] as TomlTable[] | undefined) ?? [];
        const kept = list.filter((entry) => !isMatch(entry));
        counter.removed = list.length - kept.length;
        if (kept.length === 0) Reflect.deleteProperty(raw, table);
        else raw[table] = kept;
    };
}

/**
 * Sets a dotted key to a value, creating tables on the way.
 * @param key the dotted key
 * @param value the value to write
 * @returns the mutation
 */
export function setKey(key: string, value: unknown): Mutation {
    return (raw) => {
        const { path, name } = splitKey(key);
        const table = tableAt(raw, path, true);
        if (!table) throw new Error(`\`${key}\` runs through a value that is not a table.`);
        table[name] = value;
    };
}

/**
 * Deletes a dotted key; empty tables left behind are removed too.
 * @param key the dotted key
 * @returns the mutation
 */
export function deleteKey(key: string): Mutation {
    return (raw) => {
        const { path, name } = splitKey(key);
        const tables = tablesAlong(raw, path);
        if (!tables) return;
        Reflect.deleteProperty(tables.at(-1) ?? raw, name);
        pruneEmpty(tables, path);
    };
}

/**
 * Appends entries to a list key, deduplicated, creating the list.
 * @param key the dotted key of the list
 * @param entries the entries to append
 * @returns the mutation
 */
export function appendList(key: string, entries: unknown[]): Mutation {
    return (raw) => {
        const { path, name } = splitKey(key);
        const table = tableAt(raw, path, true);
        if (!table) throw new Error(`\`${key}\` runs through a value that is not a table.`);
        const existing = table[name];
        const list: unknown[] = Array.isArray(existing) ? [...(existing as unknown[])] : [];
        for (const value of entries)
            if (list.every((item) => JSON.stringify(item) !== JSON.stringify(value))) list.push(value);
        table[name] = list;
    };
}

/**
 * Removes entries from a list key; an entry with a `name` field matches by that name too.
 * @param key the dotted key of the list
 * @param entries the entries to remove
 * @returns the mutation
 */
export function removeFromList(key: string, entries: unknown[]): Mutation {
    return (raw) => {
        const { path, name } = splitKey(key);
        const table = tableAt(raw, path, false);
        const existing = table?.[name];
        if (!table || !Array.isArray(existing)) return;
        const gone = new Set(entries.map((value) => JSON.stringify(value)));
        table[name] = (existing as unknown[]).filter(
            (item) => !gone.has(listItemKey(item)) && !gone.has(JSON.stringify(item)),
        );
    };
}

/**
 * The table a command writes into: the document itself, or the [[scope]] entry with that path.
 * @param raw the parsed document
 * @param scope the scope path, if any
 * @returns the table, or undefined when no scope has that path
 */
export function scopeHolder(raw: TomlTable, scope: string | undefined): TomlTable | undefined {
    if (scope === undefined) return raw;
    const scopes = (raw['scope'] as TomlTable[] | undefined) ?? [];
    return scopes.find((entry) => entry['path'] === scope);
}

import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/platform/errors.ts';
import { patchToml } from '#cli/parsers/toml/patch.ts';
import { stringify as stringifyToml } from 'smol-toml';
import { isReasoned } from '#cli/policy/schema/fields.ts';
import { policyIndent } from '#cli/policy/settings/known.ts';
import { wrapLongArrays } from '#cli/parsers/toml/layout.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { POLICY_LINE_WIDTH } from '#cli/config/parsers/toml.ts';
import { parseTomlText, parseStrictPolicy } from '#cli/policy/read.ts';
import { valueAt, isRecord, normalizeTables } from '#cli/platform/objects.ts';
import type { Mutation, Proposal, Reasoned, PolicyKey, TomlTable } from '#cli/types/policy/settings.ts';

function splitKey(key: string): PolicyKey {
    const path = key.split('.');
    const name = path.pop();
    if (name === undefined) throw new Error('A policy key cannot be empty.');
    return { path, name };
}

/**
 * Creates the missing tables along a dotted path.
 * @param raw the parsed document.
 * @param path the table names from the root down.
 * @returns the table at the end of the path, or undefined when the path is missing or runs through a value.
 */
function createTable(raw: TomlTable, path: string[]): TomlTable | undefined {
    let current: TomlTable = raw;
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

/**
 * Propose a policy mutation in memory and validate its resulting document.
 * @param root the repository root
 * @param text the original policy text
 * @param mutate the change to apply to the parsed document
 * @returns the new text, the parsed policy, and whether the text changed
 */
export function proposePolicy(root: string, text: string, mutate: Mutation): Proposal {
    const raw = parseTomlText(text, POLICY_FILE, 'policy');
    const before = new Set(Object.keys(raw));
    mutate(raw);
    // toml-patch cannot add an array of tables that was not there; seed the text with it first.
    let seed = text;
    for (const [key, value] of Object.entries(raw))
        if (!before.has(key) && Array.isArray(value) && value.length > 0 && typeof value[0] === 'object')
            seed = `${seed.trimEnd()}\n\n${stringifyToml({ [key]: value })}`;
    // Taplo requires TOML 1.0 inline tables, which cannot have trailing commas.
    const next = wrapLongArrays(patchToml(seed, raw), { indent: policyIndent(raw), width: POLICY_LINE_WIDTH });
    const policy = parseStrictPolicy(next, root);
    return { text: next, policy, changed: next !== text };
}

/**
 * Sets a dotted key to a value, creating tables on the way.
 * @param raw the table being edited
 * @param key the dotted key
 * @param value the value to write
 */
export function setKey(raw: TomlTable, key: string, value: unknown): void {
    const { path, name } = splitKey(key);
    const table = createTable(raw, path);
    if (!table) throw new Error(`\`${key}\` runs through a value that is not a table.`);
    table[name] = value;
}

/**
 * Deletes a dotted key; empty tables left behind are removed too.
 * @param raw the table being edited
 * @param key the dotted key
 */
export function deleteKey(raw: TomlTable, key: string): void {
    const { path, name } = splitKey(key);
    const tables = [raw];
    let table = raw;
    for (const part of path) {
        const next = table[part];
        if (!isRecord(next)) return;
        tables.push(next);
        table = next;
    }
    Reflect.deleteProperty(table, name);
    for (let index = tables.length - 1; index > 0; index -= 1) {
        const [parent, child] = tables.slice(index - 1, index + 1);
        const part = path[index - 1];
        if (parent === undefined || child === undefined || part === undefined || Object.keys(child).length > 0) break;
        Reflect.deleteProperty(parent, part);
    }
}

/**
 * Appends entries to a list key, deduplicated, creating the list.
 * @param raw the table being edited
 * @param key the dotted key of the list
 * @param entries the entries to append and their optional list reason
 */
export function addToList(raw: TomlTable, key: string, entries: Reasoned<unknown[]>): void {
    const { path, name } = splitKey(key);
    const table = createTable(raw, path);
    if (!table) throw new Error(`\`${key}\` runs through a value that is not a table.`);
    const authored = table[name];
    const current: Reasoned<unknown> = isReasoned(authored) ? authored : { value: authored };
    const existing = current.value;
    const list = [...((existing as unknown[] | undefined) ?? [])];
    for (const entry of entries.value) {
        const value = normalizeTables(entry);
        if (!list.some((item) => isDeepStrictEqual(item, value))) list.push(value);
    }
    const reason = entries.reason ?? current.reason;
    table[name] = reason === undefined ? list : { value: list, reason };
}

/**
 * Removes entries from a list key; an entry with a `name` field matches by that name too.
 * @param raw the table being edited
 * @param key the dotted key of the list
 * @param entries the entries to remove and their optional list reason
 */
export function removeFromList(raw: TomlTable, key: string, entries: Reasoned<unknown[]>): void {
    const { path, name } = splitKey(key);
    const value = valueAt(raw, path);
    const table = isRecord(value) ? value : undefined;
    const authored = table?.[name];
    const current: Reasoned<unknown> = isReasoned(authored) ? authored : { value: authored };
    const existing = current.value;
    if (!table || !Array.isArray(existing)) return;
    const gone = new Set(entries.value.map((value) => JSON.stringify(value)));
    const kept = (existing as unknown[]).filter((item) => {
        const isNamed = typeof item === 'object' && item !== null && 'name' in item;
        const identity = JSON.stringify(isNamed ? (item as TomlTable)['name'] : item);
        return !gone.has(identity) && !gone.has(JSON.stringify(item));
    });
    const reason = entries.reason ?? current.reason;
    table[name] = reason === undefined ? kept : { value: kept, reason };
}

/**
 * The table a command writes into: the document itself, or the [[scope]] entry with that path.
 * @param raw the parsed document
 * @param scope the scope path, if any
 * @returns the required table
 */
export function getScopeTable(raw: TomlTable, scope: string | undefined): TomlTable {
    if (scope === undefined) return raw;
    const scopes = (raw['scope'] as TomlTable[] | undefined) ?? [];
    const holder = scopes.find((entry) => entry['path'] === scope);
    if (holder === undefined)
        throw new GspotError('policy', [
            `gspot.toml has no [[scope]] with path \`${scope}\`. Declare it, or leave --scope out.`,
        ]);
    return holder;
}

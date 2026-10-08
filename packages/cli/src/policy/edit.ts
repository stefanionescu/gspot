import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { emitPolicy, parseTomlText, readPolicyFile } from '#cli/policy/file.ts';
import { valueAt, isRecord, createTable, normalizeTables } from '#cli/platform/objects.ts';
import type { Mutation, Proposal, PolicyKey, TomlTable, PreparedPolicy } from '#cli/types/policy/settings.ts';

function splitKey(key: string): PolicyKey {
    const path = key.split('.');
    const name = path.pop();
    if (name === undefined) throw new Error('A policy key cannot be empty.');
    return { path, name };
}

/**
 * Propose a policy mutation in memory and validate its resulting document.
 * @param root the repository root
 * @param text the original policy text
 * @param mutate the change to apply to the parsed document
 * @returns the new text, the parsed policy, and whether the text changed
 */
export function editPolicy(root: string, text: string, mutate: Mutation): Proposal {
    const raw = parseTomlText(text, POLICY_FILE, 'policy');
    mutate(raw);
    const next = isDeepStrictEqual(raw, parseTomlText(text, POLICY_FILE, 'policy')) ? text : emitPolicy(text, raw);
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
    if (table === undefined) throw new Error(`\`${key}\` runs through a value that is not a table.`);
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
 * @param entries the entries to append
 */
export function addToList(raw: TomlTable, key: string, entries: unknown[]): void {
    const { path, name } = splitKey(key);
    const table = createTable(raw, path);
    if (table === undefined) throw new Error(`\`${key}\` runs through a value that is not a table.`);
    const authored = table[name];
    const existing: unknown[] = Array.isArray(authored) ? authored : [];
    const list = [...existing];
    for (const entry of entries) {
        const value = normalizeTables(entry);
        const previous = list.find((item) =>
            isRecord(value) && Array.isArray(value['paths'])
                ? isRecord(item) && isDeepStrictEqual(item['paths'], value['paths'])
                : isDeepStrictEqual(item, value),
        );
        if (isRecord(previous) && isRecord(value)) Object.assign(previous, value);
        else if (previous === undefined) list.push(value);
    }
    table[name] = list;
}

/**
 * Removes list entries by value or name and individual paths from structured entries.
 * @param raw the table being edited
 * @param key the dotted key of the list
 * @param entries the entries to remove
 */
export function removeFromList(raw: TomlTable, key: string, entries: unknown[]): void {
    const { path, name } = splitKey(key);
    const table = valueAt(raw, path);
    if (!isRecord(table) || !Array.isArray(table[name])) return;
    const existing: unknown[] = table[name];
    const gone = new Set(
        entries.flatMap((value) =>
            isRecord(value) && Array.isArray(value['paths'])
                ? value['paths'].map((path) => JSON.stringify(path))
                : [JSON.stringify(value)],
        ),
    );
    table[name] = existing.flatMap((item) => {
        const identity = JSON.stringify(isRecord(item) && 'name' in item ? item['name'] : item);
        if (gone.has(identity) || gone.has(JSON.stringify(item))) return [];
        if (!isRecord(item) || !Array.isArray(item['paths'])) return [item];
        const paths = item['paths'].filter((path) => !gone.has(JSON.stringify(path)));
        return paths.length === 0 ? [] : [{ ...item, paths }];
    });
}

/**
 * The table a command writes into: the document itself, or the scope map entry with that path.
 * @param raw the parsed document
 * @param scope the scope path, if any
 * @returns the required table
 */
export function getScopeTable(raw: TomlTable, scope: string | undefined): TomlTable {
    if (scope === undefined) return raw;
    const scopes = raw['scope'];
    const holder = isRecord(scopes) ? scopes[scope] : undefined;
    if (!isRecord(holder))
        throw new GspotError('policy', [
            `gspot.toml has no [scope.${JSON.stringify(scope)}]. Declare it, or leave --scope out.`,
        ]);
    return holder;
}

/**
 * Capture the input bytes and mode before evaluating and validating a policy mutation.
 * @param root the repository root
 * @param mutate the change to apply to the policy text
 * @returns the validated plan with the original file
 */
export function preparePolicy(root: string, mutate: Mutation): PreparedPolicy {
    using files = openRoot(root);
    const original = files.read(POLICY_FILE);
    const text = readPolicyFile(root);
    if (original?.bytes.equals(Buffer.from(text)) !== true)
        throw new GspotError('policy', ['The gspot.toml file changed while gspot was running. Run the command again.']);
    return { ...editPolicy(root, text, mutate), original };
}

import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import { stringify } from '@decimalturn/toml-patch';
import { parseSettings } from '#cli/settings/read.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { formatSettingsText } from '#cli/settings/write/text.ts';
import { parseTomlText, readSettingsFile } from '#cli/settings/file.ts';
import { getWrittenValue, replaceWrittenValue } from '#cli/settings/inherit.ts';
import { isRecord, getValueAt, createTable, normalizeTables } from '#cli/system/values.ts';
import type { Mutation, TomlTable, SettingKey, SettingsEdit, EditedSettings } from '#cli/types/settings/file.ts';

function splitKey(key: string): SettingKey {
    const boundary = key.lastIndexOf('.');
    return { path: boundary === -1 ? [] : key.slice(0, boundary).split('.'), name: key.slice(boundary + 1) };
}

/**
 * Validate a captured settings change.
 * @param repositoryRoot the folder against which the edited scope paths resolve.
 * @param input the captured table, text, and value snapshot.
 * @param mutate the change applied once.
 * @returns the new text, validated settings, and change status.
 */
function updateSettings(repositoryRoot: string, input: SettingsEdit, mutate: Mutation): EditedSettings {
    const { text, table, values } = input;
    const reads = createReadCache(repositoryRoot);
    mutate(table);
    parseSettings(stringify(table), repositoryRoot, reads);
    const next = isDeepStrictEqual(structuredClone(table), values) ? text : formatSettingsText(text, table);
    const settings = parseSettings(next, repositoryRoot, reads);
    return { text: next, settings, changed: next !== text, original: input.original };
}

/**
 * Sets a dotted key to a value, creating tables on the way.
 * @param written the table to edit
 * @param key the dotted key
 * @param value the value to write
 */
function setKey(written: TomlTable, key: string, value: unknown): void {
    const { path, name } = splitKey(key);
    const table = createTable(written, path);
    if (table === undefined) throw new Error(`\`${key}\` runs through a value that is not a table.`);
    table[name] = value;
}

/**
 * Deletes a dotted key and the empty tables it leaves behind.
 * @param written the table to edit
 * @param key the dotted key
 */
function deleteKey(written: TomlTable, key: string): void {
    const { path, name } = splitKey(key);
    const tables = [written];
    let table = written;
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
 * @param document the table to edit
 * @param key the dotted key of the list
 * @param entries the entries to append
 */
function addToList(document: TomlTable, key: string, entries: unknown[]): void {
    const { path, name } = splitKey(key);
    const table = createTable(document, path);
    if (table === undefined) throw new Error(`\`${key}\` runs through a value that is not a table.`);
    const written = table[name];
    const value = getWrittenValue(written);
    const existing: unknown[] = Array.isArray(value) ? value : [];
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
    table[name] = replaceWrittenValue(written, list);
}

/**
 * Removes list entries by value or name and individual paths from structured entries.
 * @param document the table to edit
 * @param key the dotted key of the list
 * @param entries the entries to remove
 */
function removeFromList(document: TomlTable, key: string, entries: unknown[]): void {
    const { path, name } = splitKey(key);
    const table = getValueAt(document, path);
    if (!isRecord(table)) return;
    const written = table[name];
    const value = getWrittenValue(written);
    if (!Array.isArray(value)) return;
    const existing: unknown[] = value;
    const gone = new Set(
        entries.flatMap((value) =>
            isRecord(value) && Array.isArray(value['paths'])
                ? value['paths'].map((path) => JSON.stringify(path))
                : [JSON.stringify(value)],
        ),
    );
    const kept = existing.flatMap((item) => {
        const identity = JSON.stringify(isRecord(item) && 'name' in item ? item['name'] : item);
        if (gone.has(identity) || gone.has(JSON.stringify(item))) return [];
        if (!isRecord(item) || !Array.isArray(item['paths'])) return [item];
        const paths = item['paths'].filter((path) => !gone.has(JSON.stringify(path)));
        return paths.length === 0 ? [] : [{ ...item, paths }];
    });
    if (kept.length === 0) deleteKey(document, key);
    else table[name] = replaceWrittenValue(written, kept);
}

/**
 * The table a command writes into: the document itself, or the scope map entry with that path.
 * @param written the parsed document
 * @param scope the scope path, if any
 * @returns the required table
 */
function findScopeTable(written: TomlTable, scope: string | undefined): TomlTable {
    if (scope === undefined) return written;
    const scopes = written['scope'];
    const scopeTable: unknown = Array.isArray(scopes)
        ? scopes.find(
              (entry) =>
                  isRecord(entry) &&
                  typeof entry['path'] === 'string' &&
                  trimTrailingSlashes(entry['path']) === trimTrailingSlashes(scope),
          )
        : undefined;
    if (!isRecord(scopeTable))
        throw new GspotError(
            'arguments',
            `gspot.toml has no [[scope]] with path = ${JSON.stringify(scope)}. Add one, or leave out --scope.`,
        );
    return scopeTable;
}

/**
 * Capture the input bytes and mode before evaluating and validating a settings mutation.
 * @param repositoryRoot the folder that contains the settings file to capture.
 * @returns the edit input with the original private file
 */
function readSettingsEdit(repositoryRoot: string): SettingsEdit {
    const { text, original } = readSettingsFile(repositoryRoot);
    const table = parseTomlText(text, SETTINGS_FILE, 'settings');
    return { text, table, values: structuredClone(table), original };
}

export { setKey, deleteKey, addToList, updateSettings, findScopeTable, removeFromList, readSettingsEdit };

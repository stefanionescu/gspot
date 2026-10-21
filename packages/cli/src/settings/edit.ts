import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import { stringify } from '@decimalturn/toml-patch';
import { parseSettings } from '#cli/settings/read.ts';
import { SETTINGS_FILE } from '#cli/config/gspot-paths.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { parseTomlText, isReasonedValue, readSettingsFile } from '#cli/settings/file.ts';
import { isTable, getValueAt, createTable, normalizeTables } from '#cli/system/tables.ts';
import type { SettingKey, SettingsEdit, EditedSettings } from '#cli/types/settings/edits.ts';

function splitKey(key: string): SettingKey {
    const boundary = key.lastIndexOf('.');
    return { path: boundary === -1 ? [] : key.slice(0, boundary).split('.'), name: key.slice(boundary + 1) };
}

/**
 * Validate a captured settings change.
 *
 * @param repositoryRoot the folder against which the edited scope paths resolve.
 * @param edit the settings read before the edit.
 * @returns the validated table, text, and change status.
 */
export function buildEditedSettings(repositoryRoot: string, edit: SettingsEdit): EditedSettings {
    const { text, table } = edit;
    parseSettings(stringify(table), repositoryRoot);
    const next = isDeepStrictEqual(table, parseTomlText(text, SETTINGS_FILE)) ? text : buildSettingsText(text, table);
    const settings = parseSettings(next, repositoryRoot);
    return { text: next, settings, changed: next !== text };
}

/**
 * Set a dotted key to a value, and create tables on the way.
 *
 * @param table the table to edit.
 * @param key the dotted setting name.
 * @param value what to write.
 */
export function setKey(table: TomlTable, key: string, value: unknown): void {
    const { path, name } = splitKey(key);
    const parent = createTable(table, path);
    if (parent === undefined) throw new Error(`\`${key}\` runs through a value that is not a table.`);
    parent[name] = value;
}

/**
 * Deletes a dotted key and the empty tables it leaves behind.
 *
 * @param table the table to edit
 * @param key the dotted setting name.
 */
export function deleteKey(table: TomlTable, key: string): void {
    const { path, name } = splitKey(key);
    const tables = [table];
    let current = table;
    for (const part of path) {
        const next = current[part];
        if (!isTable(next)) return;
        tables.push(next);
        current = next;
    }
    Reflect.deleteProperty(current, name);
    for (let index = tables.length - 1; index > 0; index -= 1) {
        const [parent, child] = tables.slice(index - 1, index + 1);
        const part = path[index - 1];
        if (parent === undefined || child === undefined || part === undefined || Object.keys(child).length > 0) break;
        Reflect.deleteProperty(parent, part);
    }
}

/**
 * Append items to a list key, each once, and create the list.
 *
 * @param table the table to edit.
 * @param key the dotted name of the list.
 * @param entries the items to append.
 */
export function addToList(table: TomlTable, key: string, entries: unknown[]): void {
    const { path, name } = splitKey(key);
    const parent = createTable(table, path);
    if (parent === undefined) throw new Error(`\`${key}\` runs through a value that is not a table.`);
    const written = parent[name];
    const value = getWrittenValue(written);
    const existing: unknown[] = Array.isArray(value) ? value : [];
    const list = [...existing];
    for (const entry of entries) {
        const item = normalizeTables(entry);
        if (!list.some((listed) => isDeepStrictEqual(listed, item))) list.push(item);
    }
    parent[name] = replaceWrittenValue(written, list);
}

/**
 * Remove list items by value or name, and remove single paths from structured items.
 *
 * @param table the table to edit.
 * @param key the dotted name of the list.
 * @param entries the items to remove.
 */
export function removeFromList(table: TomlTable, key: string, entries: unknown[]): void {
    const { path, name } = splitKey(key);
    const parent = getValueAt(table, path);
    if (!isTable(parent)) return;
    const written = parent[name];
    const value = getWrittenValue(written);
    if (!Array.isArray(value)) return;
    const existing: unknown[] = value;
    const gone = new Set(
        entries.flatMap((value) =>
            isTable(value) && Array.isArray(value['paths'])
                ? value['paths'].map((path) => JSON.stringify(path))
                : [JSON.stringify(value)],
        ),
    );
    const kept = existing.flatMap((item) => {
        const identity = JSON.stringify(isTable(item) && 'name' in item ? item['name'] : item);
        if (gone.has(identity) || gone.has(JSON.stringify(item))) return [];
        if (!isTable(item) || !Array.isArray(item['paths'])) return [item];
        const paths = item['paths'].filter((path) => !gone.has(JSON.stringify(path)));
        return paths.length === 0 ? [] : [{ ...item, paths }];
    });
    if (kept.length === 0) deleteKey(table, key);
    else parent[name] = replaceWrittenValue(written, kept);
}

/**
 * Find the table that a command writes into: the document, or the scope table with that path.
 *
 * @param table the parsed document.
 * @param scope the folder of a nested table, if any.
 * @returns the document or the matching scope table.
 */
export function getScopeTable(table: TomlTable, scope: string | undefined): TomlTable {
    if (scope === undefined) return table;
    const scopes = table['scope'];
    const scopeTable: unknown = Array.isArray(scopes)
        ? scopes.find(
              (entry) =>
                  isTable(entry) &&
                  typeof entry['path'] === 'string' &&
                  trimTrailingSlashes(entry['path']) === trimTrailingSlashes(scope),
          )
        : undefined;
    if (!isTable(scopeTable))
        throw new GspotError(
            'arguments',
            `gspot.toml has no [[scope]] with path = ${JSON.stringify(scope)}. Add one, or leave out --scope.`,
        );
    return scopeTable;
}

/**
 * Read the bytes and mode of gspot.toml before an edit.
 *
 * @param repositoryRoot the folder that holds gspot.toml.
 * @returns the edit input, with the original file contents.
 */
export function readSettingsEdit(repositoryRoot: string): SettingsEdit {
    const { text, original } = readSettingsFile(repositoryRoot);
    const table = parseTomlText(text, SETTINGS_FILE);
    return { text, table, original };
}

/**
 * Read a written setting value from its reasoned value or its plain value.
 *
 * @param written the authored setting.
 * @returns the value that a settings edit changes.
 */
export function getWrittenValue(written: unknown): unknown {
    if (isReasonedValue(written)) return written.value;
    return written;
}

/**
 * Replace a written value, and keep the reason of its reasoned value.
 *
 * @param written the original setting.
 * @param value the new setting.
 * @returns the replacement in the same written form.
 */
function replaceWrittenValue(written: unknown, value: unknown): unknown {
    if (isReasonedValue(written)) return { ...written, value };
    return value;
}

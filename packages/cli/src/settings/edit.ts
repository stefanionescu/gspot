import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { formatSchema } from '#cli/schemas/settings/fields.ts';
import { isTable, getValueAt, createTable } from '#cli/system/tables.ts';
import { mergeIgnores, buildSettingsText } from '#cli/settings/text/build.ts';
import { parseTomlText, isReasonedValue, readSettingsFile } from '#cli/settings/file.ts';
import type { SettingKey, SettingsEdit, EditedSettings } from '#cli/types/settings/edits.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 3 calls in this file share it.
function splitKey(key: string): SettingKey {
    const boundary = key.lastIndexOf('.');
    return { path: boundary === -1 ? [] : key.slice(0, boundary).split('.'), name: key.slice(boundary + 1) };
}

/**
Apply a settings change to the parsed table, check the result, and build the new gspot.toml text. The change edits
input.table in place.

@param root the folder against which the edited scope paths resolve.
@param edit the settings read before the edit.
@returns the new gspot.toml text, the settings that it holds, and whether the text changed.
*/
export function buildEditedSettings(root: string, edit: SettingsEdit): EditedSettings {
    const { text, table } = edit;
    if (Array.isArray(table['ignore'])) table['ignore'] = mergeIgnores(table['ignore'] as TomlTable[]);
    const format = formatSchema.safeParse(table['format']).data ?? formatSchema.parse({});
    const next = isDeepStrictEqual(table, parseTomlText(text, SETTINGS_FILE))
        ? text
        : buildSettingsText(text, table, format);
    return { text: next, settings: parseSettings(next, root), changed: next !== text };
}

/**
Set a dotted key to a value, and create tables on the way.

@param table the table to edit.
@param key the dotted setting name.
@param value what to write.
*/
export function setKey(table: TomlTable, key: string, value: unknown): void {
    const { path, name } = splitKey(key);
    const parent = createTable(table, path);
    if (parent === undefined) throw new Error(`${key} runs through a value that is not a table.`);
    parent[name] = value;
}

/**
Delete a dotted key and the empty tables it leaves behind.

@param table the table to edit.
@param key the dotted setting name.
*/
export function deleteKey(table: TomlTable, key: string): void {
    const { path, name } = splitKey(key);
    const tables = [table];
    let walked = table;
    for (const segment of path) {
        const next = walked[segment];
        if (!isTable(next)) return;
        tables.push(next);
        walked = next;
    }
    Reflect.deleteProperty(walked, name);
    for (let index = tables.length - 1; index > 0; index -= 1) {
        const [parent, child] = tables.slice(index - 1, index + 1);
        const segment = path[index - 1];
        if (parent === undefined || child === undefined || segment === undefined || Object.keys(child).length > 0)
            break;
        Reflect.deleteProperty(parent, segment);
    }
}

function removeRecordPaths(listed: unknown, gone: Set<string | undefined>): unknown[] {
    if (!isTable(listed) || !Array.isArray(listed['paths'])) return [listed];
    const paths = listed['paths'].filter((path) => !gone.has(JSON.stringify(path)));
    return paths.length === 0 ? [] : [{ ...listed, paths }];
}

/**
Remove list items by value or name, and remove single paths from structured items.

@param table the table to edit.
@param key the dotted name of the list.
@param values the items to remove.
*/
export function removeFromList(table: TomlTable, key: string, values: unknown[]): void {
    const { path, name } = splitKey(key);
    const parent = getValueAt(table, path);
    if (!isTable(parent)) return;
    const written = parent[name];
    const value = isReasonedValue(written) ? written.value : written;
    if (!Array.isArray(value)) return;
    const gone = new Set(
        values.flatMap((removed) =>
            isTable(removed) && Array.isArray(removed['paths'])
                ? removed['paths'].map((path) => JSON.stringify(path))
                : [JSON.stringify(removed)],
        ),
    );
    const kept = value.flatMap((listed: unknown) => {
        const identity = JSON.stringify(isTable(listed) && 'name' in listed ? listed['name'] : listed);
        return gone.has(identity) || gone.has(JSON.stringify(listed)) ? [] : removeRecordPaths(listed, gone);
    });
    if (kept.length === 0) deleteKey(table, key);
    else parent[name] = isReasonedValue(written) ? { ...written, value: kept } : kept;
}

/**
Find the table that a command writes into: the document, or the scope table with that path.

@param table the parsed document.
@param scope the folder of a nested table, if any.
@returns the document or the matching scope table.
*/
export function getScopeTable(table: TomlTable, scope: string | undefined): TomlTable {
    if (scope === undefined) return table;
    const scopes = table['scope'];
    const scopeTable: unknown = Array.isArray(scopes)
        ? scopes.find(
              (each) =>
                  isTable(each) &&
                  typeof each['path'] === 'string' &&
                  trimTrailingSlashes(each['path']) === trimTrailingSlashes(scope),
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
Read the bytes and mode of gspot.toml before an edit.

@param root the folder that holds gspot.toml.
@returns the settings before the edit, with the file contents.
*/
export function readSettingsEdit(root: string): SettingsEdit {
    const { text, previous } = readSettingsFile(root);
    const table = parseTomlText(text, SETTINGS_FILE);
    return { text, table, previous };
}

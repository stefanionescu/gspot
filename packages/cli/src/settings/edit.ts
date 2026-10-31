import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { buildSettingsToml } from '#cli/settings/text.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import type { TomlTable } from '#cli/types/settings/settings.ts';
import { parseTomlFile, parseTomlSyntax } from '#cli/parsers/formats/toml.ts';
import { SETTINGS_FILE, SETTINGS_PREFACE } from '#cli/config/settings/settings.ts';
import { isTable, addTable, findValueAt, normalizeTables } from '#cli/system/tables.ts';
import type { SettingKey, SettingsEdit, EditedSettings } from '#cli/types/settings/edits.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: setKey, removeKey, and removeFromList split a dotted key at its last dot through it.
function splitKey(key: string): SettingKey {
    const boundary = key.lastIndexOf('.');
    return { path: boundary === -1 ? [] : key.slice(0, boundary).split('.'), name: key.slice(boundary + 1) };
}

function removeRecordPaths(listed: unknown, gone: Set<string | undefined>): unknown[] {
    if (!isTable(listed) || !Array.isArray(listed['paths'])) return [listed];
    const paths = listed['paths'].filter((path) => !gone.has(JSON.stringify(path)));
    return paths.length === 0 ? [] : [{ ...listed, paths }];
}

/**
Apply a settings change to edit.table, check the result, and patch it into the previous gspot.toml text.

@param root the folder against which the edited scope paths resolve.
@param edit the settings read before the edit.
*/
export function buildEditedSettings(root: string, edit: SettingsEdit): EditedSettings {
    const { text, table } = edit;
    const previous = parseTomlFile(SETTINGS_FILE, text);
    const opening = SETTINGS_PREFACE.exec(text)?.[0] ?? '';
    const body = text.slice(opening.length);
    const next = isDeepStrictEqual(normalizeTables(table), normalizeTables(previous))
        ? text
        : opening + buildSettingsToml(parseTomlSyntax(body, previous), table);
    const settings = parseSettings(next, root);
    if (Array.isArray(settings))
        throw new GspotError(
            'arguments',
            settings.map((error) => `${error.path.join('.')}: ${error.message}`).join('\n'),
        );
    return { text: next, settings, changed: next !== text };
}

/**
Set a dotted key to a value, and create tables on the way.

@param table the table to edit.
@param key the dotted setting name.
@param value what to write.
*/
export function setKey(table: TomlTable, key: string, value: unknown): void {
    const { path, name } = splitKey(key);
    const parent = addTable(table, path);
    if (parent === undefined) throw new GspotError('settings', `${key} runs through a value that is not a table.`);
    parent[name] = value;
}

/**
Delete a dotted key and the empty tables it leaves behind.

@param table the table to edit.
@param key the dotted setting name.
*/
export function removeKey(table: TomlTable, key: string): void {
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

/**
Remove list items by value or name, and remove single paths from structured items.

@param table the table to edit.
@param key the dotted name of the list.
@param values the items to remove.
*/
export function removeFromList(table: TomlTable, key: string, values: unknown[]): void {
    const { path, name } = splitKey(key);
    const parent = findValueAt(table, path);
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
    if (kept.length === 0) removeKey(table, key);
    else parent[name] = isReasonedValue(written) ? { ...written, value: kept } : kept;
}

/**
Find the table that a command writes into: the document, or the scope table of that path, added for a project folder
that has none.

@param table the parsed document.
@param scopePath the folder of a nested table, if any.
*/
export function getScopeTable(table: TomlTable, scopePath: string): TomlTable {
    if (scopePath === '') return table;
    const scopes = table['scope'];
    const scopeTable: unknown = Array.isArray(scopes)
        ? scopes.find(
              (each) =>
                  isTable(each) &&
                  typeof each['path'] === 'string' &&
                  stripTrailingSlashes(each['path']) === stripTrailingSlashes(scopePath),
          )
        : undefined;
    if (!isTable(scopeTable)) {
        const created = { path: scopePath };
        table['scope'] = [...(Array.isArray(scopes) ? (scopes as unknown[]) : []), created];
        return created;
    }
    return scopeTable;
}

import { SETTINGS_PREFACE } from '#cli/config/settings/validation.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { buildSettingsText } from '#cli/settings/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { addTable, findValueAt, isTable } from '#cli/system/tables.ts';
import type { EditedSettings, SettingKey, SettingsEdit, TomlTable } from '#cli/types/settings.ts';

function splitKey(key: string): SettingKey {
    const boundary = key.lastIndexOf('.');
    return { path: boundary === -1 ? [] : key.slice(0, boundary).split('.'), name: key.slice(boundary + 1) };
}

/**
Apply a settings change to edit.table, check the result, and patch it into the previous gspot.toml text.

@param root the folder against which the edited scope paths resolve.
@param edit the settings read before the edit.
*/
export function buildEditedSettings(root: string, edit: SettingsEdit): EditedSettings {
    const { text, table } = edit;
    const opening = SETTINGS_PREFACE.exec(text)?.[0] ?? '';
    const body = text.slice(opening.length);
    const next = opening + buildSettingsText(body, table);
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
    if (parent === undefined) throw new GspotError('arguments', `${key} runs through a value that is not a table.`);
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
Take paths out of the records of a list, and drop a record that loses its last path.

@param records the records of the list.
@param paths the paths to take out.
@param isMatch compares the path of a record with one of the paths.
@returns the records that remain, in order.
*/
export function removeRecordPaths(
    records: readonly unknown[],
    paths: readonly string[],
    isMatch: (recordPath: string, path: string) => boolean,
): unknown[] {
    return records.flatMap((record) => {
        if (!isTable(record) || !Array.isArray(record['paths'])) return [record];
        const written = record['paths'] as string[];
        const kept = written.filter((recordPath) => paths.every((path) => !isMatch(recordPath, path)));
        if (kept.length === written.length) return [record];
        return kept.length === 0 ? [] : [{ ...record, paths: kept }];
    });
}

/**
Remove items from a list: equal items from a plain list, records by name from a record list, and single paths from the
records that hold them.

@param table the table to edit.
@param key the dotted name of the list.
@param values the items to remove.
*/
export function removeFromList(table: TomlTable, key: string, values: string[]): void {
    const { path, name } = splitKey(key);
    const parent = findValueAt(table, path);
    if (!isTable(parent)) return;
    const written = parent[name];
    const value = isReasonedValue(written) ? written.value : written;
    if (!Array.isArray(value)) return;
    const gone = new Set<unknown>(values);
    const listed = value.filter((element: unknown) => !gone.has(isTable(element) ? element['name'] : element));
    const kept = removeRecordPaths(listed, values, (recordPath, removed) => recordPath === removed);
    if (kept.length === 0) removeKey(table, key);
    else parent[name] = isReasonedValue(written) ? { ...written, value: kept } : kept;
}

/**
Find the table that a command writes into: the document, or the scope table of that path, added for a project folder
that has none.

@param table the parsed document.
@param scopePath the folder of a nested table, if any.
*/
export function addScopeTable(table: TomlTable, scopePath: string): TomlTable {
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

/**
Write the values of one table into another, table by table.

@param target the table to change.
@param source the values to write.
@returns the changed table.
*/
export function overlayTable(target: TomlTable, source: TomlTable): TomlTable {
    for (const [key, value] of Object.entries(source))
        target[key] = isTable(value) && isTable(target[key]) ? overlayTable(target[key], value) : value;
    return target;
}

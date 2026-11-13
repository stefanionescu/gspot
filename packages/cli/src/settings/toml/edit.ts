import { isDeepStrictEqual } from 'node:util';

import { ESCAPED_GLOB_CHARACTERS, SETTINGS_PAGE_SENTENCE, SETTINGS_PREFACE } from '#cli/config/settings/file.ts';
import { extractKeyName } from '#cli/settings/lookup.ts';
import { safeParseSettings } from '#cli/settings/parse.ts';
import { buildSettingsText } from '#cli/settings/toml/text.ts';
import { findSetting } from '#cli/settings/values/inherit.ts';
import { isReasonedValue, listWrittenKeys } from '#cli/settings/values/written.ts';
import { GspotError } from '#cli/system/errors.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { addTable, findValueAt, isTable } from '#cli/system/tables.ts';
import {
    type AvailableSettings,
    type EditedSettings,
    type IgnoreRecord,
    type IgnoreRemoval,
    type ParsedSettingValue,
    type Setting,
    type SettingKey,
    type SettingsFile,
    type SettingsTable,
    type TomlTable,
} from '#cli/types/settings.ts';

function splitKey(key: string): SettingKey {
    const boundary = key.lastIndexOf('.');
    return { path: boundary === -1 ? [] : key.slice(0, boundary).split('.'), name: extractKeyName(key) };
}

function setSettingValue(scopeTable: TomlTable, change: ParsedSettingValue, setting: Setting, key: string): void {
    if (change.type === 'list') setKey(scopeTable, key, change.value);
    else if (setting.type === 'table' && isTable(change.value)) {
        const written = findValueAt(scopeTable, key.split('.'));
        const writtenValue = isReasonedValue(written) ? written.value : written;
        setKey(scopeTable, key, { ...(isTable(writtenValue) && writtenValue), ...change.value });
    } else setKey(scopeTable, key, change.value);
}

function removeRecordPaths(
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

export function buildEditedSettings(root: string, edit: SettingsFile): EditedSettings {
    const { text, table } = edit;
    const opening = SETTINGS_PREFACE.exec(text)?.[0] ?? '';
    const body = text.slice(opening.length);
    const next = opening + buildSettingsText(body, table);
    const settings = safeParseSettings(next, root);
    if ('errors' in settings)
        throw new GspotError(
            'arguments',
            [
                ...settings.errors.map((error) => `${error.path.join('.')}: ${error.message}`),
                SETTINGS_PAGE_SENTENCE,
            ].join('\n'),
        );
    return { text: next, settings, changed: next !== text };
}

export function setKey(table: TomlTable, key: string, value: unknown): void {
    const { path, name } = splitKey(key);
    const parent = addTable(table, path);
    if (parent === undefined) throw new GspotError('arguments', `${key} runs through a value that is not a table.`);
    parent[name] = value;
}

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

export function removeUnknownKeys(
    table: TomlTable,
    written: SettingsTable,
    availableSettings: AvailableSettings,
): string[] {
    const keys = listWrittenKeys(written, availableSettings).filter(
        (key) => findSetting(availableSettings, key) === undefined,
    );
    for (const key of keys) removeKey(table, key);
    return keys;
}

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

export function overlayTable(target: TomlTable, source: TomlTable): TomlTable {
    for (const [key, value] of Object.entries(source))
        target[key] = isTable(value) && isTable(target[key]) ? overlayTable(target[key], value) : value;
    return target;
}

/**
Add an ignore to the list, or merge its paths into the record with the same check, rule, and reason.
When either record has no paths, the merged record has none. Changes ignores in place.
*/
export function mergeIgnore(ignores: TomlTable[], ignore: TomlTable): TomlTable {
    const { paths: writtenPaths, ...identity } = ignore;
    const matching = ignores.find(({ paths: _previousPaths, ...previous }) => isDeepStrictEqual(previous, identity));
    if (matching === undefined) {
        const saved = { ...ignore };
        ignores.push(saved);
        return saved;
    }
    const previous: unknown = matching['paths'];
    if (Array.isArray(writtenPaths) && Array.isArray(previous)) {
        const paths: readonly unknown[] = writtenPaths;
        const previousPaths: readonly unknown[] = previous;
        matching['paths'] = [...new Set([...previousPaths, ...paths])];
    } else delete matching['paths'];
    return matching;
}

export function setSetting(
    scopeTable: TomlTable,
    change: ParsedSettingValue,
    setting: Setting,
    options: { key: string; reason?: string | undefined },
): void {
    setSettingValue(scopeTable, change, setting, options.key);
    if (options.reason === undefined || setting.reason_values === true) return;
    const written = findValueAt(scopeTable, options.key.split('.'));
    const value = isReasonedValue(written) ? written.value : written;
    setKey(scopeTable, options.key, { value, reason: options.reason });
}

export function removeTableKeys(scopeTable: TomlTable, key: string, names: string[]): void {
    const written = findValueAt(scopeTable, key.split('.'));
    const table = isReasonedValue(written) ? written.value : written;
    if (!isTable(table)) return;
    for (const name of names) Reflect.deleteProperty(table, name);
    if (Object.keys(table).length === 0) removeKey(scopeTable, key);
}

export function removeIgnores(
    table: TomlTable,
    options: Pick<IgnoreRecord, 'check' | 'rule' | 'paths'>,
): IgnoreRemoval {
    const { check, rule, paths } = options;
    const ignores = (table['ignore'] as IgnoreRecord[] | undefined) ?? [];
    const matching = new Set(
        ignores.filter((ignore) => ignore.check === check && (rule === undefined || ignore.rule === rule)),
    );
    const kept = ignores.flatMap((ignore) => {
        if (!matching.has(ignore)) return [ignore];
        if (paths === undefined) return [];
        return removeRecordPaths(
            [ignore],
            paths,
            (recordPath, path) =>
                recordPath.replaceAll(ESCAPED_GLOB_CHARACTERS, '$1') === path.replaceAll(ESCAPED_GLOB_CHARACTERS, '$1'),
        ) as IgnoreRecord[];
    });
    const changed = kept.filter((ignore) => !ignores.includes(ignore));
    const narrowed = ignores.filter((ignore) => matching.has(ignore) && !kept.includes(ignore));
    const everyPath = [...matching].filter((ignore) => ignore.paths === undefined);
    return {
        kept,
        deleted: ignores.length - kept.length,
        changedIgnores: changed.length,
        removedPaths:
            narrowed.flatMap((ignore) => ignore.paths ?? []).length -
            changed.flatMap((ignore) => ignore.paths ?? []).length,
        everywhere: paths === undefined ? [] : everyPath,
    };
}

import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { buildSettings } from '#cli/settings/read.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { isRecord, getValueAt } from '#cli/system/values.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { findDeclaration, getSettingValue } from '#cli/settings/inherit.ts';
import { detectDefaults, buildKnownSettings } from '#cli/settings/known.ts';
import { type Settings, type WrittenTable } from '#cli/types/settings/values.ts';

function isInheritedValueChanged(
    name: string,
    key: string,
    segments: string[],
    writtenTable: WrittenTable,
    tables: WrittenTable[],
    settings: Settings,
): boolean {
    const consumers = tables.filter(({ scope }) => isInScope(scope, writtenTable.scope));
    const omitted = structuredClone(writtenTable.table);
    Reflect.deleteProperty(getValueAt(omitted, segments.slice(0, -1)) as TomlTable, name);
    const changed = { ...settings };
    if (writtenTable.scope === '') changed.written = omitted;
    else {
        const previous = settings.scopes[writtenTable.scope] as Settings['scopes'][string];
        changed.scopes = { ...settings.scopes, [writtenTable.scope]: { ...previous, written: omitted } };
    }
    return !consumers.every((consumer) =>
        isDeepStrictEqual(
            getSettingValue(consumer.known, settings, key, consumer.scope)?.value,
            getSettingValue(consumer.known, changed, key, consumer.scope)?.value,
        ),
    );
}

function parseConfigurationSelection(table: TomlTable) {
    return {
        configurations: settingsSchema.shape.configurations.parse(table['configurations']),
        removed_configurations: settingsSchema.shape.removed_configurations.parse(table['removed_configurations']),
    };
}

function dropTableDefaults(
    table: TomlTable,
    writtenTable: WrittenTable,
    tables: WrittenTable[],
    settings: Settings,
    path: string[] = [],
): TomlTable {
    const fields = Object.entries(table).map(([name, value]) => {
        const segments = [...path, name];
        const key = segments.join('.');
        return { name, value, segments, key, declaration: findDeclaration(writtenTable.known, key)?.declaration };
    });
    const declared = new Map(
        fields
            .filter(({ declaration }) => declaration !== undefined)
            .flatMap(({ name, value, key, segments }) => {
                return isInheritedValueChanged(name, key, segments, writtenTable, tables, settings)
                    ? [[name, value]]
                    : [];
            }),
    );
    const rootFields = new Map<string, z.ZodType>(path.length === 0 ? Object.entries(settingsSchema.shape) : []);
    const remaining = new Map(
        fields
            .filter(({ declaration }) => declaration === undefined)
            .flatMap(({ name, value, segments }) => {
                const defaultValue = rootFields.get(name)?.safeParse(undefined);
                if (defaultValue?.success === true && isDeepStrictEqual(value, defaultValue.data)) return [];
                return [
                    [
                        name,
                        isRecord(value) ? dropTableDefaults(value, writtenTable, tables, settings, segments) : value,
                    ],
                ];
            }),
    );
    const kept = new Map([...declared, ...remaining]);
    const entries = Object.keys(table)
        .filter((name) => kept.has(name))
        .map((name) => [name, kept.get(name)] as const);
    return Object.fromEntries(
        entries.filter(
            ([name, value]) =>
                !isRecord(value) ||
                Object.keys(value).length > 0 ||
                (isRecord(table[name]) && Object.keys(table[name]).length === 0),
        ),
    );
}

/**
 * Drop written values that equal the default, but keep a scope override of its parent.
 * @param settings the ordered draft, whose declarations own the defaults.
 * @returns the draft without values that equal the default.
 */
function dropDefaults(settings: TomlTable): TomlTable {
    const reads = createReadCache(process.cwd());
    const manifests = readManifests(reads);
    const parsed = settingsSchema.parse(settings);
    const effectiveSettings = buildSettings(parsed, settings);
    const level = settingsSchema.shape.level.parse(settings['level']);
    const scopes = (settings['scope'] ?? []) as TomlTable[];
    const selection = {
        ...parseConfigurationSelection(settings),
        scopes: Object.fromEntries(
            scopes.map((table) => [trimTrailingSlashes(table['path'] as string), parseConfigurationSelection(table)]),
        ),
    };
    const root = {
        scope: '',
        table: settings,
        known: buildKnownSettings(selectForScope(selection, '', manifests), level, reads),
    };
    const tables = [
        root,
        ...scopes.map<WrittenTable>((table) => {
            const scope = trimTrailingSlashes(table['path'] as string);
            return {
                scope,
                table,
                known: buildKnownSettings(selectForScope(selection, scope, manifests), level, reads),
            };
        }),
    ].toSorted((left, right) => compareScopeDepth(left.scope, right.scope));
    // The writer has no project input to prove a computed default. Keep a written choice until the writer knows that input.
    const unproved = [...detectDefaults({})].filter(([, value]) => value === undefined);
    for (const [key] of unproved) for (const table of tables) table.known.defaults.delete(key);
    for (const [index, table] of scopes.entries()) {
        const scope = trimTrailingSlashes(table['path'] as string);
        const writtenTable = tables.find((entry) => entry.scope === scope) as WrittenTable;
        scopes[index] = dropTableDefaults(writtenTable.table, writtenTable, tables, effectiveSettings);
    }
    if (scopes.length > 0) settings['scope'] = scopes;
    return dropTableDefaults(settings, root, tables, effectiveSettings);
}

export { dropDefaults };

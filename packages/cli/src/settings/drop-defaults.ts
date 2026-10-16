import type { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { isRecord, getValueAt } from '#cli/system/values.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import type { WrittenTable } from '#cli/types/settings/values.ts';
import { settingsSchema } from '#cli/settings/schema/gspot-toml.ts';
import { knownSettings, detectedDefaults } from '#cli/settings/view.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { mergeValue, writtenValue, declarationFor, settingDefault, settingCandidates } from '#cli/settings/inherit.ts';

function configurationSelection(table: TomlTable) {
    return {
        configurations: settingsSchema.shape.configurations.parse(table['configurations']),
        removed_configurations: settingsSchema.shape.removed_configurations.parse(table['removed_configurations']),
    };
}

function inheritedValue(tables: WrittenTable[], key: string, consumer: WrittenTable, omitted?: string): unknown {
    const match = declarationFor(consumer.known, key);
    if (match === undefined) return undefined;
    let value = settingDefault(consumer.known, match, consumer.scope, (dependentKey) =>
        inheritedValue(tables, dependentKey, consumer),
    )?.value;
    for (const table of tables.filter(({ scope }) => isInScope(consumer.scope, scope))) {
        const candidates = settingCandidates(match, key)
            .filter((candidate) => !(table.scope === omitted && candidate === key))
            .map((candidate) => getValueAt(table.table, candidate.split('.')))
            .filter((written) => written !== undefined);
        for (const written of candidates) {
            value = mergeValue(match.declaration, value, writtenValue(written));
        }
    }
    return value;
}

function dropTableDefaults(
    table: TomlTable,
    writtenTable: WrittenTable,
    tables: WrittenTable[],
    path: string[] = [],
): TomlTable {
    const fields = Object.entries(table).map(([name, value]) => {
        const segments = [...path, name];
        const key = segments.join('.');
        return { name, value, segments, key, declaration: declarationFor(writtenTable.known, key)?.declaration };
    });
    const declared = new Map(
        fields
            .filter(({ declaration }) => declaration !== undefined)
            .flatMap(({ name, value, key }) => {
                const consumers = tables.filter(({ scope }) => isInScope(scope, writtenTable.scope));
                return consumers.every((consumer) =>
                    isDeepStrictEqual(
                        inheritedValue(tables, key, consumer),
                        inheritedValue(tables, key, consumer, writtenTable.scope),
                    ),
                )
                    ? []
                    : [[name, value]];
            }),
    );
    const rootFields = new Map<string, z.ZodType>(path.length === 0 ? Object.entries(settingsSchema.shape) : []);
    const remaining = new Map(
        fields
            .filter(({ declaration }) => declaration === undefined)
            .flatMap(({ name, value, segments }) => {
                const defaultValue = rootFields.get(name)?.safeParse(undefined);
                if (defaultValue?.success === true && isDeepStrictEqual(value, defaultValue.data)) return [];
                return [[name, isRecord(value) ? dropTableDefaults(value, writtenTable, tables, segments) : value]];
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
 * Omit redundant written defaults without erasing a scope's override of its parent.
 * @param settings the independent ordered draft whose selected declarations own the defaults
 * @returns the draft without redundant setting values
 */
export function dropDefaults(settings: TomlTable): TomlTable {
    const manifests = configurationManifests();
    const level = settingsSchema.shape.level.parse(settings['level']);
    const scopes = (settings['scope'] ?? []) as TomlTable[];
    const selection = {
        ...configurationSelection(settings),
        scope: Object.fromEntries(
            scopes.map((table) => [trimTrailingSlashes(table['path'] as string), configurationSelection(table)]),
        ),
    };
    const root = { scope: '', table: settings, known: knownSettings(selectForScope(selection, '', manifests), level) };
    const tables = [
        root,
        ...scopes.map<WrittenTable>((table) => {
            const scope = trimTrailingSlashes(table['path'] as string);
            return { scope, table, known: knownSettings(selectForScope(selection, scope, manifests), level) };
        }),
    ].toSorted((left, right) => compareScopeDepth(left.scope, right.scope));
    // The writer has no project input to prove a computed default. Keep a written choice until the writer knows that input.
    const unproved = [...detectedDefaults({})].filter(([, value]) => value === undefined);
    for (const [key] of unproved) for (const table of tables) table.known.defaults.delete(key);
    for (const [index, table] of scopes.entries()) {
        const scope = trimTrailingSlashes(table['path'] as string);
        const writtenTable = tables.find((entry) => entry.scope === scope) as WrittenTable;
        scopes[index] = dropTableDefaults(writtenTable.table, writtenTable, tables);
    }
    if (scopes.length > 0) settings['scope'] = scopes;
    return dropTableDefaults(settings, root, tables);
}

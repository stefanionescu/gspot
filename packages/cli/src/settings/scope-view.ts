import { createTable } from '#cli/system/values.ts';
import { isScopeCovered } from '#cli/repository/scopes.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { IgnoreRecord } from '#cli/types/settings/file.ts';
import { ISO_DATE_LENGTH } from '#cli/config/settings/values.ts';
import { tableValuesSchema } from '#cli/settings/schema/tables.ts';
import { rootSettingSchemas } from '#cli/settings/schema/gspot-toml.ts';
import { limitTableSchema, namingCategorySchema } from '#cli/settings/schema/parts.ts';
import { SETTING_LANGUAGES, NAMING_LANGUAGE_CATEGORIES } from '#cli/config/settings/schema.ts';
import { listSettings, getSettingValue, getSettingTable, listApplicableTables } from '#cli/settings/inherit.ts';

import {
    type Settings,
    type ScopeView,
    type KnownSettings,
    type ScopeSettings,
    type ScopeSelection,
    type EffectiveSetting,
} from '#cli/types/settings/values.ts';

function listNamingVariants(known: KnownSettings, settings: Settings, scope: string): EffectiveSetting[] {
    return SETTING_LANGUAGES.flatMap((language) =>
        Object.keys(namingCategorySchema.shape).flatMap((field) => [
            `naming.${language}.${field}`,
            ...NAMING_LANGUAGE_CATEGORIES[language].map((category) => `naming.${language}.${category}.${field}`),
        ]),
    )
        .filter((key) => !known.declarations.has(key))
        .map((key) => getSettingValue(known, settings, key, scope))
        .filter((row) => row !== undefined);
}

/**
 * Select saved ignores whose expiry date has not arrived.
 * @param settings the parsed gspot.toml, with expired ignores.
 * @returns the ignores that apply today in UTC.
 */
function listActiveIgnores(settings: Settings): IgnoreRecord[] {
    const today = new Date().toISOString().slice(0, ISO_DATE_LENGTH);
    return settings.ignore.filter((entry) => entry.until === undefined || today < entry.until.toISOString());
}

/**
 * Build the merged view of a scope from the known settings, the written settings, and the configurations of the scope.
 * @param known the declarations and defaults of the selection.
 * @param settings the written root values and scoped overrides.
 * @param selected the manifests of the scope.
 * @param scope the folder, '' for the root.
 * @returns the view the templates read.
 */
function buildScopeView(known: KnownSettings, settings: Settings, selected: Manifest[], scope: string): ScopeView {
    const {
        settings: entries,
        values,
        limits,
        test_files: testFiles,
    } = buildScopeSettings(known, settings, selected, scope);
    const ignores = listActiveIgnores(settings).map((entry) => ({ ...entry, paths: entry.paths ?? [] }));
    const format = values.format;
    return {
        configurations: selected.map((manifest) => manifest.configuration.name),
        test_files: testFiles,
        settings: entries,
        values,
        format,
        limit: (key, language) => {
            const value = limits[`${language ?? ''}.${key}`] ?? limits[`.${key}`];
            if (value === undefined)
                throw new Error(
                    `The selected scope has no ${[language, key].filter((part) => part !== undefined).join('.')} limit.`,
                );
            return value;
        },
        options: (name) => {
            const value = values[name];
            if (value === undefined) throw new Error(`The selected scope has no ${name} settings.`);
            return value;
        },
        ignoresFor: (check) => ignores.filter((entry) => entry.check === check),
        rulesOff: (check) =>
            ignores
                .filter((entry) => entry.check === check)
                .filter((entry) => entry.paths.length === 0 || isScopeCovered(entry.paths, scope))
                .map((entry) => entry.rule)
                .filter((rule) => rule !== undefined),
        extra: (name) => {
            const found = listApplicableTables(settings, scope)
                .map(({ table }) => table.tools?.[name]?.['extra'])
                .filter((value): value is Record<string, unknown> => typeof value === 'object');
            if (found.length === 0) return undefined;
            return Object.fromEntries(found.flatMap((value) => Object.entries(value)));
        },
    };
}

/**
 * Resolve the known settings once into validated table values and numeric limits.
 * @param known the declarations and defaults.
 * @param settings the written gspot.toml.
 * @param selected the configurations of the scope.
 * @param scope the folder to resolve for.
 * @returns typed execution values without adding defaults to written tables.
 */
function buildScopeSettings(
    known: KnownSettings,
    settings: Settings,
    selected: Manifest[],
    scope: string,
): ScopeSettings {
    const listed = listSettings(known, settings, scope);
    const entries = Object.fromEntries(listed.map((row) => [row.key, row.value]));
    const namespaces: Record<string, unknown> = {};
    fillTableValues(namespaces, listed);
    const variants = listNamingVariants(known, settings, scope);
    fillTableValues(namespaces, variants);
    const declarations = [...known.declarations.values()].filter(
        (entry) => entry.name.startsWith('limits.') && entry.type === 'number',
    );
    const keys = [...new Set(declarations.map((entry) => entry.name.slice(entry.name.lastIndexOf('.') + 1)))];
    const languages = [
        ...new Set([
            '',
            ...selected.map((manifest) => manifest.configuration.name),
            ...declarations.flatMap((entry) => entry.name.split('.').slice(1, -1)),
            ...listApplicableTables(settings, scope).flatMap(({ table }) =>
                table.limits === undefined
                    ? []
                    : Object.entries(table.limits)
                          .filter(([, value]) => typeof value === 'object')
                          .map(([language]) => language),
            ),
        ]),
    ];
    const limits = limitTableSchema.parse(
        Object.fromEntries(
            keys.flatMap((key) =>
                languages
                    .map((language) => [
                        `${language}.${key}`,
                        getSettingValue(
                            known,
                            settings,
                            language === '' ? `limits.${key}` : `limits.${language}.${key}`,
                            scope,
                        )?.value,
                    ])
                    .filter(([, value]) => value !== undefined),
            ),
        ),
    );
    return {
        settings: entries,
        values: tableValuesSchema.parse(namespaces),
        limits,
        test_files: rootSettingSchemas.test_files.unwrap().parse(entries['test_files']),
    };
}

/**
 * Fill settings tables from direct settings and their declared naming variants.
 * @param namespaces the run tables of the scope.
 * @param rows the values that the declarations already resolved.
 */
function fillTableValues(namespaces: Record<string, unknown>, rows: EffectiveSetting[]): void {
    const entries = rows
        .filter((row) => Object.hasOwn(tableValuesSchema.in.shape, getSettingTable(row.key)))
        .map((row) => {
            const segments = row.key.split('.');
            const name = getSettingTable(row.key);
            const path = segments.slice(name.split('.').length);
            return { row, name, path: path.slice(0, -1), field: path.slice(-1).join('') };
        });
    for (const { row, name } of entries.filter(({ row }) => row.value === undefined)) {
        if (createTable(namespaces, [name]) === undefined)
            throw new Error(`The setting ${row.key} runs through a non-table value.`);
    }
    for (const { row, name, path, field } of entries.filter(({ row }) => row.value !== undefined)) {
        const table = createTable(namespaces, [name, ...path]);
        if (table === undefined) throw new Error(`The setting ${row.key} runs through a non-table value.`);
        table[field] = row.reason === undefined ? row.value : { value: row.value, reason: row.reason };
    }
}

/**
 * Find the selection of the repository root, which every run has.
 * @param scopes the selection of each scope, the root among them.
 * @returns the selection of the scope with an empty path.
 */
function findRootSelection(scopes: readonly ScopeSelection[]): ScopeSelection {
    const root = scopes.find((selection) => selection.scope.path === '');
    if (root === undefined) throw new Error('The scopes hold no repository root.');
    return root;
}

export { buildScopeView, findRootSelection, listActiveIgnores };

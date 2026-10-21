import { isScopeCovered } from '#cli/repository/scopes.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { getValueAt, createTable } from '#cli/system/values.ts';
import type { IgnoreRecord } from '#cli/types/settings/file.ts';
import { tableValuesSchema } from '#cli/schemas/settings/tables.ts';
import { namingCategorySchema } from '#cli/schemas/settings/parts.ts';
import type { TableValues, TableSettings } from '#cli/types/settings/tables.ts';
import { listSettings, getSettingValue, getSettingTable } from '#cli/settings/inherit.ts';
import { findSettingSchema, rootSettingSchemas } from '#cli/schemas/settings/gspot-toml.ts';
import { SETTING_LANGUAGES, NAMING_LANGUAGE_CATEGORIES } from '#cli/config/settings/schema.ts';

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

function listLimitVariants(known: KnownSettings, settings: Settings, scope: string): EffectiveSetting[] {
    return [...known.declarations.values()]
        .filter((declaration) => declaration.name.startsWith('limits.') && declaration.type === 'number')
        .flatMap((declaration) =>
            (declaration.languages ?? []).map(
                (language) => `limits.${language}.${declaration.name.slice(declaration.name.lastIndexOf('.') + 1)}`,
            ),
        )
        .filter((key) => !known.declarations.has(key))
        .map((key) => getSettingValue(known, settings, key, scope))
        .filter((row) => row !== undefined);
}

/**
 * Build the merged view of a scope from the known settings, the written settings, and the configurations of the scope.
 *
 * @param known the declarations and defaults of the selection.
 * @param settings the written root values and scoped overrides.
 * @param selected the manifests of the scope.
 * @param scope the folder, '' for the root.
 * @returns the view the templates read.
 */
function buildScopeView(known: KnownSettings, settings: Settings, selected: Manifest[], scope: string): ScopeView {
    const { settings: entries, values, test_files: testFiles } = buildScopeSettings(known, settings, scope);
    const ignores = settings.ignore.map((entry) => ({ ...entry, paths: entry.paths ?? [] }));
    return {
        configurations: selected.map((manifest) => manifest.configuration.name),
        test_files: testFiles,
        settings: entries,
        values,
        ignores,
    };
}

/**
 * Read one validated table from the scope's merged values.
 *
 * @param view the merged scope data.
 * @param name the table's dotted name.
 * @returns the requested table.
 */
function getTable<Name extends keyof TableValues>(view: ScopeView, name: Name): TableSettings<Name> {
    const value = view.values[name];
    if (value === undefined) throw new Error(`The selected scope has no ${name} settings.`);
    return value;
}

/**
 * Read a language's limit, falling back to the scope's general limit.
 *
 * @param view the merged scope data.
 * @param key the limit name.
 * @param language the language, if the check reads a language-specific value.
 * @returns the numeric limit.
 */
function getLimit(view: ScopeView, key: string, language?: string): number {
    const value = getValueAt(view.values.limits, [language ?? '', key]) ?? getValueAt(view.values.limits, [key]);
    if (typeof value !== 'number')
        throw new Error(
            `The selected scope has no ${[language, key].filter((part) => part !== undefined).join('.')} limit.`,
        );
    return value;
}

/**
 * List the written ignores that apply to a check or to every check.
 *
 * @param view the merged scope data.
 * @param check the check name.
 * @returns the matching ignores with normalized paths.
 */
function listIgnores(view: ScopeView, check: string): ScopeView['ignores'] {
    return view.ignores.filter((entry) => entry.check === check || entry.check === undefined);
}

/**
 * List the lint rules disabled throughout the selected scope.
 *
 * @param selection the scope and its merged data.
 * @param check the check name.
 * @returns the disabled rule names.
 */
function listIgnoredRules(selection: ScopeSelection, check: string): string[] {
    return selection.view.ignores
        .filter((entry) => entry.check === check)
        .filter((entry) => entry.paths.length === 0 || isScopeCovered(entry.paths, selection.scope.path))
        .map((entry) => entry.rule)
        .filter((rule) => rule !== undefined);
}

/**
 * Resolve the known settings once into validated table values and numeric limits.
 *
 * @param known the declarations and defaults.
 * @param settings the written gspot.toml.
 * @param scope the folder to resolve for.
 * @returns typed execution values without adding defaults to written tables.
 */
function buildScopeSettings(known: KnownSettings, settings: Settings, scope: string): ScopeSettings {
    const listed = listSettings(known, settings, scope);
    const entries = Object.fromEntries(listed.map((row) => [row.key, row.value]));
    const namespaces: Record<string, unknown> = {};
    fillTableValues(namespaces, listed);
    const variants = listNamingVariants(known, settings, scope);
    fillTableValues(namespaces, variants);
    fillTableValues(namespaces, listLimitVariants(known, settings, scope));
    return {
        settings: entries,
        values: tableValuesSchema.parse(namespaces),
        test_files: rootSettingSchemas.test_files.unwrap().parse(entries['test_files']),
    };
}

/**
 * Fill settings tables from direct settings and their declared naming variants.
 *
 * @param namespaces the run tables of the scope.
 * @param rows the values that the declarations already resolved.
 */
function fillTableValues(namespaces: Record<string, unknown>, rows: EffectiveSetting[]): void {
    const entries = rows
        .filter(
            (row) =>
                Object.hasOwn(tableValuesSchema.in.shape, getSettingTable(row.key)) &&
                findSettingSchema(row.key) !== undefined,
        )
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
 *
 * @param scopes the selection of each scope, the root among them.
 * @returns the selection of the scope with an empty path.
 */
function findRootSelection(scopes: readonly ScopeSelection[]): ScopeSelection {
    const root = scopes.find((selection) => selection.scope.path === '');
    if (root === undefined) throw new Error('The scopes hold no repository root.');
    return root;
}

/**
 * Check whether an ignore covers whole files: it names no lint rule and no function.
 *
 * @param entry the ignore record.
 * @returns whether the ignore keeps its paths out of the check.
 */
function isFileIgnore(entry: Pick<IgnoreRecord, 'rule' | 'names'>): boolean {
    return entry.rule === undefined && entry.names === undefined;
}

export { getTable, getLimit, listIgnores, isFileIgnore, buildScopeView, listIgnoredRules, findRootSelection };

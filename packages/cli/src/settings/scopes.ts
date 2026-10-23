import { getValueAt, createTable } from '#cli/system/tables.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { tableValuesSchema } from '#cli/schemas/settings/tables.ts';
import { namingCategorySchema } from '#cli/schemas/settings/fields.ts';
import { findSettingSchema, rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import type { Settings, TableValues, TableSettings } from '#cli/types/settings/file.ts';
import { isInScope, isScopeCovered, compareScopeDepth } from '#cli/repository/scopes.ts';
import { SETTING_LANGUAGES, NAMING_LANGUAGE_CATEGORIES } from '#cli/config/settings/naming.ts';
import { selectConfigurations, listAutomaticConfigurations } from '#cli/configurations/select.ts';
import { getSettingTable, getSettingValue, listEffectiveSettings } from '#cli/settings/inherit.ts';

import type {
    Scope,
    ScopeValues,
    ScopeSettings,
    EffectiveSetting,
    AvailableSettings,
    SelectedConfigurations,
} from '#cli/types/settings/inheritance.ts';

/**
 * Find the nearest scope that holds a path.
 *
 * @param scopes every project scope.
 * @param path the repository-relative destination.
 * @returns the scope, or undefined at the root.
 */
export function findParentScope(scopes: Scope[], path: string): Scope | undefined {
    return scopes
        .filter(({ folder }) => folder.path !== path && isInScope(path, folder.path))
        .toSorted((left, right) => compareScopeDepth(left.folder.path, right.folder.path))
        .at(-1);
}

/**
 * Select the configurations of the root and each parent scope, each once, in order.
 *
 * @param selected the configuration lists as written.
 * @param selected.configurations the root choices.
 * @param selected.scopes each folder with its written choices.
 * @param selected.removed_configurations the names that you removed.
 * @param scope the folder to select for.
 * @param configurations every configuration.
 * @returns the configurations in order.
 */
export function selectForScope(
    selected: SelectedConfigurations,
    scope: string,
    configurations: Map<string, Configuration>,
): Configuration[] {
    const automatic = listAutomaticConfigurations(configurations);
    const choices = new Set<string>();
    const tables = [
        selected,
        ...Object.entries(selected.scopes)
            .filter(([ancestor]) => isInScope(scope, ancestor))
            .toSorted(([left], [right]) => compareScopeDepth(left, right))
            .map(([, scopeTable]) => scopeTable),
    ];
    for (const table of tables) {
        for (const removed of table.removed_configurations) choices.delete(removed);
        for (const configuration of table.configurations) choices.add(configuration);
    }
    return selectConfigurations([...choices, ...automatic], configurations);
}

function listNamingVariants(
    availableSettings: AvailableSettings,
    settings: Settings,
    scope: string,
): EffectiveSetting[] {
    return SETTING_LANGUAGES.flatMap((language) =>
        Object.keys(namingCategorySchema.shape).flatMap((field) => [
            `naming.${language}.${field}`,
            ...NAMING_LANGUAGE_CATEGORIES[language].map((category) => `naming.${language}.${category}.${field}`),
        ]),
    )
        .filter((key) => !availableSettings.settings.has(key))
        .map((key) => getSettingValue(availableSettings, settings, key, scope))
        .filter((row) => row !== undefined);
}

function listLimitVariants(
    availableSettings: AvailableSettings,
    settings: Settings,
    scope: string,
): EffectiveSetting[] {
    return [...availableSettings.settings.values()]
        .filter((setting) => setting.name.startsWith('limits.') && setting.type === 'number')
        .flatMap((setting) =>
            (setting.languages ?? []).map(
                (language) => `limits.${language}.${setting.name.slice(setting.name.lastIndexOf('.') + 1)}`,
            ),
        )
        .filter((key) => !availableSettings.settings.has(key))
        .map((key) => getSettingValue(availableSettings, settings, key, scope))
        .filter((row) => row !== undefined);
}

/**
 * Build the merged settings of a scope from the known settings, the written settings, and the configurations of the
 * scope.
 *
 * @param availableSettings the settings and defaults of the selected configurations.
 * @param settings the written root values and scoped overrides.
 * @param configurations the configurations that the scope selects.
 * @param scope the folder, '' for the root.
 * @returns the scope settings that planning, checks, and the config file builders read.
 */
export function buildScopeSettings(
    availableSettings: AvailableSettings,
    settings: Settings,
    configurations: Configuration[],
    scope: string,
): ScopeSettings {
    const {
        settings: settingRows,
        values,
        test_files: testFiles,
    } = buildScopeValues(availableSettings, settings, scope);
    const ignores = settings.ignore.map((ignore) => ({ ...ignore, paths: ignore.paths ?? [] }));
    return {
        configurations: configurations.map((configuration) => configuration.name),
        test_files: testFiles,
        settings: settingRows,
        values,
        ignores,
    };
}

/**
 * Read one validated table from the scope's merged values.
 *
 * @param scopeSettings the merged scope data.
 * @param name the table's dotted name.
 * @returns the requested table.
 */
export function getTable<Name extends keyof TableValues>(
    scopeSettings: ScopeSettings,
    name: Name,
): TableSettings<Name> {
    const value = scopeSettings.values[name];
    if (value === undefined) throw new Error(`The selected scope has no ${name} settings.`);
    return value;
}

/**
 * Read a language's limit, falling back to the scope's general limit.
 *
 * @param scopeSettings the merged scope data.
 * @param key the limit name.
 * @param language the language, if the check reads a language-specific value.
 * @returns the numeric limit.
 */
export function getLimit(scopeSettings: ScopeSettings, key: string, language?: string): number {
    const value =
        getValueAt(scopeSettings.values.limits, [language ?? '', key]) ??
        getValueAt(scopeSettings.values.limits, [key]);
    if (typeof value !== 'number')
        throw new Error(
            `The selected scope has no ${[language, key].filter((name) => name !== undefined).join('.')} limit.`,
        );
    return value;
}

/**
 * List the written ignores that apply to a check or to every check.
 *
 * @param scopeSettings the merged scope data.
 * @param check the check name.
 * @returns the matching ignores with normalized paths.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 7 calls in 6 files share it.
export function listIgnores(scopeSettings: ScopeSettings, check: string): ScopeSettings['ignores'] {
    return scopeSettings.ignores.filter((ignore) => ignore.check === check || ignore.check === undefined);
}

/**
 * List the lint rules disabled throughout the selected scope.
 *
 * @param scope the scope and its merged data.
 * @param check the check name.
 * @returns the disabled rule names.
 */
export function listIgnoredRules(scope: Scope, check: string): string[] {
    return scope.settings.ignores
        .filter((ignore) => ignore.check === check)
        .filter((ignore) => ignore.paths.length === 0 || isScopeCovered(ignore.paths, scope.folder.path))
        .map((ignore) => ignore.rule)
        .filter((rule) => rule !== undefined);
}

function buildScopeValues(availableSettings: AvailableSettings, settings: Settings, scope: string): ScopeValues {
    const listed = listEffectiveSettings(availableSettings, settings, scope);
    const valuesByKey = Object.fromEntries(listed.map((row) => [row.key, row.value]));
    const namespaces: Record<string, unknown> = {};
    fillTableValues(namespaces, listed);
    const variants = listNamingVariants(availableSettings, settings, scope);
    fillTableValues(namespaces, variants);
    fillTableValues(namespaces, listLimitVariants(availableSettings, settings, scope));
    return {
        settings: valuesByKey,
        values: tableValuesSchema.parse(namespaces),
        test_files: rootSettingSchemas.test_files.unwrap().parse(valuesByKey['test_files']),
    };
}

function fillTableValues(tables: Record<string, unknown>, rows: EffectiveSetting[]): void {
    const valueRows = rows
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
    for (const { row, name } of valueRows.filter(({ row }) => row.value === undefined)) {
        if (createTable(tables, [name]) === undefined)
            throw new Error(`The setting ${row.key} runs through a non-table value.`);
    }
    for (const { row, name, path, field } of valueRows.filter(({ row }) => row.value !== undefined)) {
        const table = createTable(tables, [name, ...path]);
        if (table === undefined) throw new Error(`The setting ${row.key} runs through a non-table value.`);
        table[field] = row.reason === undefined ? row.value : { value: row.value, reason: row.reason };
    }
}

/**
 * Find the root scope, which every run has.
 *
 * @param scopes every scope, the root among them.
 * @returns the scope with an empty path.
 */
export function findRootScope(scopes: readonly Scope[]): Scope {
    const root = scopes.find((scope) => scope.folder.path === '');
    if (root === undefined) throw new Error('The scopes hold no repository root.');
    return root;
}

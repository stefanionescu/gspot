import { settingPaths } from '#cli/policy/paths.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { limitTableSchema } from '#cli/policy/schema/fields.ts';
import { rootSettingSchemas } from '#cli/policy/schema/policy.ts';
import { isInScope, byScopeDepth } from '#cli/repository/selectors.ts';
import { settingValueSchemas } from '#cli/policy/schema/setting-values.ts';
import type { Manifest, SettingDeclaration } from '#cli/types/configurations.ts';
import { compact, valueAt, isRecord, createTable } from '#cli/platform/objects.ts';
import { activeSettingNamespacesSchema } from '#cli/policy/schema/active-settings.ts';
import { TOOL_KEY_DEPTH, CATEGORY_KEY_PARTS, LANGUAGE_GROUP_TABLES } from '#cli/config/policy/settings.ts';

import type {
    Policy,
    PolicyTable,
    SettingState,
    KnownSettings,
    PolicyLocation,
    ScopeSelection,
    AuthoredSetting,
    ResolvedSetting,
    DeclarationMatch,
    ResolvedSettings,
    ArchitectureDeclaration,
} from '#cli/types/policy/settings.ts';

function languageDeclaration(
    surface: KnownSettings,
    key: string,
    table: string,
    language: string,
    name: string,
): DeclarationMatch | undefined {
    const base = surface.declarations.get(`${table}.${name}`);
    const languages = base?.languages ?? [];
    if (base && (languages.includes(language) || languages.includes('*'))) return { declaration: base, language };
    const grouped = surface.declarations.get(key);
    return grouped ? { declaration: grouped } : undefined;
}

function groupedDeclaration(
    surface: KnownSettings,
    key: string,
    table: string,
    language: string,
    rest: string[],
): DeclarationMatch | undefined {
    const [first, second] = rest;
    if (first === undefined) return undefined;
    if (second === undefined) return languageDeclaration(surface, key, table, language, first);
    if (table !== 'naming' || rest.length !== CATEGORY_KEY_PARTS) return undefined;
    return categoryDeclaration(surface, language, first, second);
}

function categoryDeclaration(
    surface: KnownSettings,
    language: string,
    category: string,
    name: string,
): DeclarationMatch | undefined {
    const base = surface.declarations.get(`naming.${language}.${name}`) ?? surface.declarations.get(`naming.${name}`);
    if (!base) return undefined;
    const isCovered = (base.languages ?? []).includes(language) && (base.categories ?? []).includes(category);
    return isCovered ? { declaration: base, language, category } : undefined;
}

function applyLayer(
    declaration: SettingDeclaration,
    key: string,
    current: SettingState,
    layer: PolicyTable,
    candidates: string[],
): SettingState {
    let result = current;
    for (const candidate of candidates) {
        const found = policyValue(layer.table, candidate);
        if (!found) continue;
        result = {
            value: mergeValue(
                declaration,
                result.value,
                valueAt(layer.table.configurationSettings, candidate.split('.')) ??
                    valueAt(layer.table, candidate.split('.')) ??
                    found.value,
            ),
            source: candidate === key ? layer.name : `${layer.name} (${candidate})`,
            reason: found.reason,
        };
    }
    return result;
}

/**
 * Ordered command arguments replace intact; other lists append, per-rule tables merge, and scalars replace.
 * @param declaration the setting
 * @param current the value so far
 * @param found the value the next layer writes
 * @returns the merged value
 */
export function mergeValue(declaration: SettingDeclaration, current: unknown, found: unknown): unknown {
    if (
        declaration.name !== 'architecture.modules' &&
        !declaration.name.endsWith('_command') &&
        Array.isArray(current) &&
        Array.isArray(found)
    ) {
        const previous: unknown[] = current;
        const next: unknown[] = found;
        return [...new Set([...previous, ...next])];
    }
    if (declaration.type === 'table' && declaration.direction === 'rule-options')
        return Object.fromEntries([current, found].filter(isRecord).flatMap((table) => Object.entries(table)));
    return found;
}

/**
 * The root policy and every scope table, with their locations in the document.
 * @param policy the repository policy
 * @returns the tables in authored order, root first
 */
export function everyTable(policy: Policy): PolicyLocation[] {
    return [
        { table: policy, path: [] },
        ...Object.keys(policy.scope).flatMap<PolicyLocation>((scope) => {
            const table = policy.scopeTables[scope];
            return table === undefined ? [] : [{ table, scope, path: ['scope', scope] }];
        }),
    ];
}

/**
 * The root policy and applicable scope tables, ordered from outermost to innermost.
 * @param policy the repository policy
 * @param scope the scope path, '' or undefined for the root alone
 * @returns the tables with their scope paths and reported names
 */
export function tablesFor(policy: Policy, scope: string | undefined): PolicyTable[] {
    return everyTable(policy)
        .filter((entry) => entry.scope === undefined || isInScope(scope ?? '', entry.scope))
        .toSorted((left, right) => byScopeDepth(left.scope ?? '', right.scope ?? ''))
        .map(({ table, scope: path = '' }) => ({
            table,
            path,
            name: path === '' ? POLICY_FILE : `[scope.${JSON.stringify(path)}]`,
        }));
}

/**
 * Effective module contracts in each selected scope, preserving authored path origins.
 * @param scopes the resolved configuration selections
 * @returns declarations consumed by native architecture rules and their tool requirements
 */
export function declaredArchitectures(scopes: ScopeSelection[]): ArchitectureDeclaration[] {
    return scopes.flatMap((selection) => {
        const architecture = selection.view.values.architecture;
        return architecture === undefined || architecture.modules.length === 0
            ? []
            : [
                  {
                      selection,
                      architecture: {
                          modules: architecture.modules.map((module) => ({
                              ...module,
                              may_import: module.may_import ?? [],
                          })),
                          roles: selection.view.roles,
                      },
                  },
              ];
    });
}

/**
 * Matches a written key to the declaration it belongs to: per-language and per-category variants map back to their base declaration.
 *
 * @param surface the surface of the selection
 * @param key the dotted key as written
 * @returns the declaration with the language and category the key names, or undefined when nothing exposes it
 */
export function declarationFor(surface: KnownSettings, key: string): DeclarationMatch | undefined {
    const direct = surface.declarations.get(key);
    if (direct) return { declaration: direct };
    const [table, language, ...rest] = key.split('.');
    if (table === undefined || language === undefined || !LANGUAGE_GROUP_TABLES.has(table)) return undefined;
    return groupedDeclaration(surface, key, table, language, rest);
}

/**
 * Reads the raw value a policy holds for a dotted key, or undefined.
 * @param policy the root table or one scope table
 * @param key the dotted key
 * @returns the value with its reason, or undefined when the key is not written
 */
export function policyValue(policy: Partial<Policy>, key: string): AuthoredSetting | undefined {
    const value: unknown = valueAt(policy.authored, key.split('.'));
    return value === undefined ? undefined : compact({ value, reason: policy.reasons?.[key] });
}

/**
 * Resolve an authored language or category key after its broader declaration.
 * @param match the setting's native declaration and authored selector
 * @param key the authored dotted key
 * @returns candidate keys from the broadest declaration to the selected field
 */
export function settingCandidates(match: DeclarationMatch, key: string): string[] {
    return match.language === undefined
        ? [key]
        : [
              match.declaration.name,
              ...(match.category === undefined
                  ? []
                  : [`naming.${match.language}.${key.slice(key.lastIndexOf('.') + 1)}`]),
              key,
          ];
}

/**
 * Resolves one key: configuration default, root table, scope table. Lists append and deduplicate; scalars replace.
 *
 * @param surface the surface of the selection.
 * @param policy the loaded policy.
 * @param key the dotted key.
 * @param scope the scope path whose table applies last, if any.
 * @returns the value with where it came from, or undefined when nothing exposes the key.
 */
export function settingValue(
    surface: KnownSettings,
    policy: Policy,
    key: string,
    scope?: string,
): ResolvedSetting | undefined {
    const match = declarationFor(surface, key);
    if (!match) return undefined;
    const { declaration } = match;
    const shipped = surface.defaults.get(declaration.name);
    const layers = tablesFor(policy, scope);
    const start: SettingState = {
        value: settingPaths(declaration.name, shipped?.value, scope ?? ''),
        source: shipped ? `configuration ${shipped.configuration}` : 'unset',
        reason: undefined,
    };
    const candidates = settingCandidates(match, key);
    let current = start;
    for (const layer of layers) current = applyLayer(declaration, key, current, layer, candidates);
    const { value, source, reason } = current;
    return {
        key,
        declaration,
        value,
        source,
        ...compact({ reason, scope }),
    };
}

/**
 * The effective value of every setting the surface declares, in key order.
 *
 * @param surface the surface of the selection
 * @param policy the loaded policy
 * @param scope the scope path whose table applies last, if any
 * @returns the resolved settings in key order
 */
export function listSettings(surface: KnownSettings, policy: Policy, scope?: string): ResolvedSetting[] {
    const keys = surface.declarations
        .keys()
        .toArray()
        .toSorted((a, b) => a.localeCompare(b));
    return keys.map((key) => settingValue(surface, policy, key, scope)).filter((row) => row !== undefined);
}

/**
 * Resolve the selected surface once into validated namespace values and numeric limits.
 * @param surface the selected declarations and defaults
 * @param policy the authored repository policy
 * @param selected the selected configurations
 * @param scope the selected scope path
 * @returns typed execution values without adding defaults to authored tables
 */
export function effectiveSettings(
    surface: KnownSettings,
    policy: Policy,
    selected: Manifest[],
    scope: string,
): ResolvedSettings {
    const resolved = listSettings(surface, policy, scope);
    const settings = Object.fromEntries(resolved.map((row) => [row.key, row.value]));
    const namespaces: Record<string, unknown> = {};
    const rows = resolved
        .map((row) => {
            const segments = row.key.split('.');
            const depth = segments[0] === 'tools' ? TOOL_KEY_DEPTH : 1;
            return { row, path: segments.slice(depth, -1), name: segments.slice(0, depth).join('.') };
        })
        .filter(({ row }) => Object.hasOwn(settingValueSchemas, row.declaration.name));
    for (const { row, path, name } of rows) {
        const holder = createTable(namespaces, row.value === undefined ? [name] : [name, ...path]);
        const key = row.key.slice(row.key.lastIndexOf('.') + 1);
        if (holder === undefined) throw new Error(`The setting ${row.key} runs through a non-table value.`);
        if (row.value !== undefined) holder[key] = row.value;
    }
    const declarations = [...surface.declarations.values()].filter(
        (entry) => entry.name.startsWith('limits.') && entry.type === 'number',
    );
    const keys = [...new Set(declarations.map((entry) => entry.name.slice(entry.name.lastIndexOf('.') + 1)))];
    const languages = [
        ...new Set([
            '',
            ...selected.map((manifest) => manifest.configuration.name),
            ...declarations.flatMap((entry) => entry.name.split('.').slice(1, -1)),
            ...tablesFor(policy, scope).flatMap(({ table }) =>
                table.limits === undefined ? [] : Object.keys(table.limits.groups),
            ),
        ]),
    ];
    const limits = limitTableSchema.parse(
        Object.fromEntries(
            keys.flatMap((key) =>
                languages
                    .map((language) => [
                        `${language}.${key}`,
                        settingValue(
                            surface,
                            policy,
                            language === '' ? `limits.${key}` : `limits.${language}.${key}`,
                            scope,
                        )?.value,
                    ])
                    .filter(([, value]) => value !== undefined),
            ),
        ),
    );
    return {
        settings,
        values: activeSettingNamespacesSchema.parse(namespaces),
        limits,
        test_files: rootSettingSchemas.test_files.unwrap().parse(settings['test_files']),
    };
}

/**
 * Reads the paths assigned to one architecture role.
 * @param roles the authored role paths
 * @param role the role name
 * @returns the paths, or an empty list when the role is absent
 */
export function rolePaths(
    roles: Policy['architecture']['roles'],
    role: keyof Policy['architecture']['roles'],
): string[] {
    const value = roles[role];
    return value === undefined ? [] : [value].flat();
}

/**
 * The test harness folders of one scope, which architecture.roles.test_harness names: the scope's own, else the root's.
 * @param policy the policy
 * @param scope the scope path, empty for the root
 * @returns repository-relative folders, none when the policy names no harness
 */
export function harnessFolders(policy: Policy, scope: string): string[] {
    const nested = policy.scopeTables[scope]?.architecture?.roles;
    const roles = nested?.['test_harness'] === undefined ? policy.architecture.roles : nested;
    return rolePaths(roles, 'test_harness').map((folder) => folder.replace(/\/(?:\*\*)?$/u, ''));
}

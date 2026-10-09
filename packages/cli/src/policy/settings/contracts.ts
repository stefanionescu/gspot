import { settingPaths } from '#cli/policy/paths.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { SettingDeclaration } from '#cli/types/configurations.ts';
import { compact, valueAt, isRecord } from '#cli/platform/contracts.ts';
import { isInScope, byScopeDepth } from '#cli/repository/paths/public.ts';
import { CATEGORY_KEY_PARTS, LANGUAGE_GROUP_TABLES } from '#cli/config/policy/settings.ts';

import type {
    Policy,
    PolicyTable,
    SettingState,
    SettingEntry,
    KnownSettings,
    PolicyLocation,
    ScopeSelection,
    AuthoredSetting,
    DeclarationMatch,
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
): SettingEntry | undefined {
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
export function listSettings(surface: KnownSettings, policy: Policy, scope?: string): SettingEntry[] {
    const keys = surface.declarations
        .keys()
        .toArray()
        .toSorted((a, b) => a.localeCompare(b));
    return keys.map((key) => settingValue(surface, policy, key, scope)).filter((row) => row !== undefined);
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

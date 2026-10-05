import { isReasoned } from '#cli/policy/schema/fields.ts';
import type { SettingSpec } from '#cli/types/configurations.ts';
import { compact, valueAt, isRecord } from '#cli/platform/objects.ts';
import { isInScope, byScopeDepth } from '#cli/repository/selectors.ts';
import { CATEGORY_KEY_PARTS, LANGUAGE_GROUP_TABLES } from '#cli/config/policy/settings.ts';

import type {
    Policy,
    Reasoned,
    SpecMatch,
    PolicyTable,
    SettingState,
    KnownSettings,
    PolicyLocation,
    ResolvedSetting,
    NamingLanguageTable,
} from '#cli/types/policy/settings.ts';

function plain(value: unknown): Reasoned<unknown> {
    if (!isReasoned(value)) return { value };
    return value.reason === undefined ? { value: value.value } : { value: value.value, reason: value.reason };
}

function plainIfPresent(value: unknown): Reasoned<unknown> | undefined {
    return value === undefined ? undefined : plain(value);
}

function languageSpec(
    surface: KnownSettings,
    key: string,
    table: string,
    language: string,
    name: string,
): SpecMatch | undefined {
    const base = surface.specs.get(`${table}.${name}`);
    const languages = base?.languages ?? [];
    if (base && (languages.includes(language) || languages.includes('*'))) return { spec: base, language };
    const grouped = surface.specs.get(key);
    return grouped ? { spec: grouped } : undefined;
}

function groupedSpec(
    surface: KnownSettings,
    key: string,
    table: string,
    language: string,
    rest: string[],
): SpecMatch | undefined {
    const [first, second] = rest;
    if (first === undefined) return undefined;
    if (second === undefined) return languageSpec(surface, key, table, language, first);
    if (table !== 'naming' || rest.length !== CATEGORY_KEY_PARTS) return undefined;
    return categorySpec(surface, language, first, second);
}

function categorySpec(surface: KnownSettings, language: string, category: string, name: string): SpecMatch | undefined {
    const base = surface.specs.get(`naming.${name}`);
    if (!base) return undefined;
    const isCovered = (base.languages ?? []).includes(language) && (base.categories ?? []).includes(category);
    return isCovered ? { spec: base, language, category } : undefined;
}

function limitValue(policy: Partial<Policy>, rest: string[]): Reasoned<unknown> | undefined {
    const [first, second] = rest;
    if (first === undefined) return undefined;
    const entry = second === undefined ? policy.limits?.root[first] : policy.limits?.groups[first]?.[second];
    return plainIfPresent(entry);
}

function languageValue(
    language: NamingLanguageTable,
    slot: string,
    categorySlot: string | undefined,
): Reasoned<unknown> | undefined {
    if (categorySlot === undefined) return plainIfPresent(valueAt(language, [slot]));
    return plainIfPresent(valueAt(language.categories[slot], [categorySlot]));
}

function namingValue(policy: Partial<Policy>, rest: string[]): Reasoned<unknown> | undefined {
    const naming = policy.naming;
    const [languageName, slot, categorySlot] = rest;
    if (!naming || languageName === undefined) return undefined;
    if (slot === undefined) return plainIfPresent(valueAt(naming, [languageName]));
    const language = naming.languages[languageName];
    return language ? languageValue(language, slot, categorySlot) : undefined;
}

function applyLayer(
    spec: SettingSpec,
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
            value: mergeValue(spec, result.value, found.value),
            source: candidate === key ? layer.name : `${layer.name} (${candidate})`,
            reason: found.reason,
        };
    }
    return result;
}

// The declarations of one kind, without the kind field each carries.
function declarationsOf(policy: Partial<Policy>, kind: string): unknown {
    return policy.declarations?.filter((entry) => entry.kind === kind).map(({ kind: _kind, ...entry }) => entry);
}

// The keys that live at the top of the policy, read from their normalized fields.
const ROOT_SETTING_READERS: Record<string, (policy: Partial<Policy>) => unknown> = {
    generated: (policy) => declarationsOf(policy, 'generated'),
    vendored: (policy) => declarationsOf(policy, 'vendored'),
};

/**
 * A list appends, dropping repeated scalar items; a per-rule table merges by rule; any other value takes the later one.
 * @param spec the setting
 * @param current the value so far
 * @param found the value the next layer writes
 * @returns the merged value
 */
export function mergeValue(spec: SettingSpec, current: unknown, found: unknown): unknown {
    if (spec.type === 'list' && Array.isArray(current) && Array.isArray(found))
        return [...new Set([...(current as unknown[]), ...(found as unknown[])])];
    if (spec.type === 'table' && spec.direction === 'rule-options')
        return { ...(isRecord(current) ? current : {}), ...(isRecord(found) ? found : {}) };
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
        ...policy.scopes.flatMap<PolicyLocation>((scope, index) => {
            const table = policy.scopeTables[scope.path];
            return table === undefined ? [] : [{ table, scope: scope.path, path: ['scope', index] }];
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
            name: path === '' ? 'gspot.toml' : `[[scope]] ${path}`,
        }));
}

/**
 * Matches a written key to the spec it belongs to: per-language and per-category variants map back to their base spec.
 *
 * @param surface the surface of the selection
 * @param key the dotted key as written
 * @returns the spec with the language and category the key names, or undefined when nothing exposes it
 */
export function specFor(surface: KnownSettings, key: string): SpecMatch | undefined {
    const direct = surface.specs.get(key);
    if (direct) return { spec: direct };
    const [table, language, ...rest] = key.split('.');
    if (table === undefined || language === undefined || !LANGUAGE_GROUP_TABLES.has(table)) return undefined;
    return groupedSpec(surface, key, table, language, rest);
}

/**
 * Reads the raw value a policy holds for a dotted key, or undefined.
 * @param policy the root table or one scope table
 * @param key the dotted key
 * @returns the value with its reason, or undefined when the key is not written
 */
export function policyValue(policy: Partial<Policy>, key: string): Reasoned<unknown> | undefined {
    const [table, ...rest] = key.split('.');
    const topLevel = ROOT_SETTING_READERS[key];
    if (topLevel !== undefined) return plainIfPresent(topLevel(policy));
    if (table === 'limits') return limitValue(policy, rest);
    if (table === 'naming') return namingValue(policy, rest);
    if (table === undefined) return undefined;
    const tables: Record<string, unknown> = { agent_rules: policy.agentRules, ...policy.configurationSettings };
    return plainIfPresent(valueAt(tables[table] ?? valueAt(policy, [table]), rest));
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
    const match = specFor(surface, key);
    if (!match) return undefined;
    const { spec } = match;
    const shipped = surface.defaults.get(spec.name);
    const layers = tablesFor(policy, scope);
    const declaredLicenses =
        key === 'licenses.allowed' && layers.some((layer) => policyValue(layer.table, key) !== undefined);
    const start: SettingState = {
        value: declaredLicenses ? [] : shipped?.value,
        source: shipped ? `configuration ${shipped.configuration}` : 'unset',
        reason: undefined,
    };
    const candidates = match.language === undefined ? [key] : [spec.name, key];
    let current = start;
    for (const layer of layers) current = applyLayer(spec, key, current, layer, candidates);
    const { value, source, reason } = current;
    return {
        key,
        spec,
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
    const keys = surface.specs
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
export function rolePaths(roles: Policy['architecture']['roles'], role: string): string[] {
    const value = roles[role];
    return value === undefined ? [] : [value].flat();
}

/**
 * The test harness folders of one scope, which architecture.roles.test_support names: the scope's own, else the root's.
 * @param policy the policy
 * @param scope the scope path, empty for the root
 * @returns the folders relative to the scope root, none when the policy names no harness
 */
export function harnessFolders(policy: Policy, scope: string): string[] {
    const nested = policy.scopeTables[scope]?.architecture?.roles;
    const roles = nested?.['test_support'] === undefined ? policy.architecture.roles : nested;
    return rolePaths(roles, 'test_support').map((folder) => folder.replace(/\/(?:\*\*)?$/u, ''));
}

/**
 * The test-support folders relative to the repository root.
 * @param policy the authored role settings
 * @param scope the scope owning the folders
 * @returns the scope-prefixed harness folders
 */
export function repositoryHarnessFolders(policy: Policy, scope: string): string[] {
    return harnessFolders(policy, scope).map((folder) => [scope, folder].filter(Boolean).join('/'));
}

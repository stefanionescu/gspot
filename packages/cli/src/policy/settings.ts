import type { SettingSpec } from '#cli/types/kits.ts';
import { compact, isRecord } from '#cli/platform/text.ts';
import { scopeAncestors } from '#cli/repository/scopes.ts';
import { LANGUAGE_GROUP_TABLES } from '#cli/config/policy/policy.ts';

import type {
    Policy,
    Reasoned,
    SpecMatch,
    PolicyLayer,
    SettingState,
    WrittenValue,
    ExposedSettings,
    ResolvedSetting,
    NamingLanguageTable,
} from '#cli/types/policy/policy.ts';

// A category setting is naming.<language>.<category>.
const CATEGORY_KEY_PARTS = 2;

function isReasoned(value: unknown): value is Reasoned<unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        'value' in value &&
        Object.keys(value).every((key) => key === 'value' || key === 'reason')
    );
}

function plain(value: unknown): WrittenValue {
    if (!isReasoned(value)) return { value };
    return value.reason === undefined ? { value: value.value } : { value: value.value, reason: value.reason };
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Six readers turn an absent value into undefined before plain(); one owner keeps that rule.
function plainIfPresent(value: unknown): WrittenValue | undefined {
    return value === undefined ? undefined : plain(value);
}

function walk(start: unknown, parts: string[]): unknown {
    let current = start;
    for (const part of parts) {
        const record = asRecord(current);
        if (!record) return undefined;
        current = record[part];
    }
    return current;
}

function languageSpec(
    surface: ExposedSettings,
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
    surface: ExposedSettings,
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

function categorySpec(
    surface: ExposedSettings,
    language: string,
    category: string,
    name: string,
): SpecMatch | undefined {
    const base = surface.specs.get(`naming.${name}`);
    if (!base) return undefined;
    const isCovered = (base.languages ?? []).includes(language) && (base.categories ?? []).includes(category);
    return isCovered ? { spec: base, language, category } : undefined;
}

function limitValue(policy: Partial<Policy>, rest: string[]): WrittenValue | undefined {
    const [first, second] = rest;
    if (first === undefined) return undefined;
    const entry = second === undefined ? policy.limits?.root[first] : policy.limits?.groups[first]?.[second];
    return plainIfPresent(entry);
}

function languageValue(
    language: NamingLanguageTable,
    slot: string,
    categorySlot: string | undefined,
): WrittenValue | undefined {
    if (categorySlot === undefined) return plainIfPresent(asRecord(language)?.[slot]);
    return plainIfPresent(asRecord(language.categories[slot])?.[categorySlot]);
}

function namingValue(policy: Partial<Policy>, rest: string[]): WrittenValue | undefined {
    const naming = policy.naming;
    const [languageName, slot, categorySlot] = rest;
    if (!naming || languageName === undefined) return undefined;
    if (slot === undefined) return plainIfPresent(asRecord(naming)?.[languageName]);
    const language = naming.languages[languageName];
    return language ? languageValue(language, slot, categorySlot) : undefined;
}

function applyLayer(
    spec: SettingSpec,
    key: string,
    current: SettingState,
    layer: PolicyLayer,
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

function applyLayers(
    spec: SettingSpec,
    key: string,
    start: SettingState,
    layers: PolicyLayer[],
    candidates: string[],
): SettingState {
    let result = start;
    for (const layer of layers) result = applyLayer(spec, key, result, layer, candidates);
    return result;
}

// The declarations of one kind, without the kind field each carries.
function declarationsOf(policy: Partial<Policy>, kind: string): unknown {
    return policy.declarations?.filter((entry) => entry.kind === kind).map(({ kind: _nature, ...entry }) => entry);
}

// The keys that live at the top of the policy, read from their normalized fields.
const ROOT_SETTING_READERS: Record<string, (policy: Partial<Policy>) => unknown> = {
    generated: (policy) => declarationsOf(policy, 'generated'),
    vendored: (policy) => declarationsOf(policy, 'vendored'),
    require_reasons: (policy) => policy.requireReasons,
    extra_checks: (policy) => policy.extraChecks,
};

/**
 * A list setting appends and deduplicates; a scalar setting takes the later value.
 * @param spec the setting
 * @param current the value so far
 * @param found the value the next layer writes
 * @returns the merged value
 */
export function mergeValue(spec: SettingSpec, current: unknown, found: unknown): unknown {
    if (spec.kind === 'list' && Array.isArray(current) && Array.isArray(found))
        return [...new Set([...(current as unknown[]), ...(found as unknown[])])];
    if (spec.kind === 'table' && spec.direction === 'per-rule') return { ...asRecord(current), ...asRecord(found) };
    return found;
}

/**
 * The root policy and applicable scope tables, ordered from outermost to innermost.
 * @param policy the repository policy
 * @param scope the scope path, '' or undefined for the root alone
 * @returns the tables with the name each is reported under
 */
export function policyTables(policy: Policy, scope: string | undefined): PolicyLayer[] {
    return [
        { table: policy, name: 'gspot.toml' },
        ...scopeAncestors(policy.scopes, scope ?? '').flatMap((entry) => {
            const table = policy.scopeTables[entry.path];
            return table === undefined ? [] : [{ table, name: `[[scope]] ${entry.path}` }];
        }),
    ];
}

/**
 * Narrows a value to a table: a plain object that is not a list or a date.
 * @param value anything
 * @returns the value as a record, or undefined for anything else
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The policy readers and the init proposal narrow about twenty values to tables by this test.
export function asRecord(value: unknown): Record<string, unknown> | undefined {
    return isRecord(value) ? value : undefined;
}

/**
 * Matches a written key to the spec it belongs to: per-language and per-category variants map back to their base spec.
 *
 * @param surface the surface of the selection
 * @param key the dotted key as written
 * @returns the spec with the language and category the key names, or undefined when nothing exposes it
 */
export function specFor(surface: ExposedSettings, key: string): SpecMatch | undefined {
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
export function policyValue(policy: Partial<Policy>, key: string): WrittenValue | undefined {
    const [table, ...rest] = key.split('.');
    const topLevel = ROOT_SETTING_READERS[key];
    if (topLevel !== undefined) return plainIfPresent(topLevel(policy));
    if (table === 'limits') return limitValue(policy, rest);
    if (table === 'naming') return namingValue(policy, rest);
    if (table === undefined) return undefined;
    return plainIfPresent(walk(asRecord(policy)?.[table], rest));
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
    surface: ExposedSettings,
    policy: Policy,
    key: string,
    scope?: string,
): ResolvedSetting | undefined {
    const match = specFor(surface, key);
    if (!match) return undefined;
    const { spec } = match;
    const shipped = surface.defaults.get(spec.name) ?? surface.defaults.get(key);
    const layers = policyTables(policy, scope);
    const declaredLicenses =
        key === 'tools.licenses.licenses_allowed' &&
        layers.some((layer) => policyValue(layer.table, key) !== undefined);
    const start: SettingState = {
        value: declaredLicenses ? [] : shipped?.value,
        source: shipped ? `kit ${shipped.kit}` : 'unset',
        reason: undefined,
    };
    const candidates = match.language === undefined ? [key] : [spec.name, key];
    const { value, source, reason } = applyLayers(spec, key, start, layers, candidates);
    return {
        key,
        spec,
        value,
        source,
        ...compact({ reason, scope }),
    };
}

/**
 * Effective exposed settings for command output and documentation.
 *
 * @param surface the surface of the selection
 * @param policy the loaded policy
 * @param scope the scope path whose table applies last, if any
 * @returns the resolved settings in key order
 */
export function listSettings(surface: ExposedSettings, policy: Policy, scope?: string): ResolvedSetting[] {
    const keys = surface.specs
        .keys()
        .toArray()
        .toSorted((a, b) => a.localeCompare(b));
    return keys.map((key) => settingValue(surface, policy, key, scope)).filter((row) => row !== undefined);
}

/**
 * The test harness folders of one scope, which architecture.roles.harness names: the scope's own, else the root's.
 * @param policy the policy
 * @param scope the scope path, empty for the root
 * @returns the folders relative to the scope root, none when the policy names no harness
 */
export function harnessFolders(policy: Policy, scope: string): string[] {
    const value = policy.scopeTables[scope]?.architecture?.roles['harness'] ?? policy.architecture.roles['harness'];
    return value === undefined ? [] : [value].flat().map((folder) => folder.replace(/\/(?:\*\*)?$/u, ''));
}

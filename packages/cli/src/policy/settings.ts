import * as messages from '#cli/policy/messages.ts';
import { scopeAncestors } from '#cli/repository/scopes.ts';
import type { SettingSpec } from '#cli/configurations/schema.ts';
import type { Manifest } from '#cli/configurations/read-manifests.ts';
import { COVERAGE_STRICT, TOOL_DEADLINE } from '#cli/configurations/settings.ts';
import { rootSettingSchemas, integrationSettingSchemas } from '#cli/policy/schema.ts';
import type { NamingCategoryTable, NamingLanguageTable, Policy, Reasoned } from '#cli/policy/normalize.ts';

const LANGUAGE_GROUP_TABLES = new Set(['limits', 'naming']);

const NAMING_SCALARS = ['max_chars', 'max_words', 'case'] as const;

const OVERRIDING_KINDS = new Set(['framework', 'platform', 'library', 'database']);

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

function limitKeys(policy: Partial<Policy>): string[] {
    if (!policy.limits) return [];
    const keys = Object.keys(policy.limits.root).map((key) => `limits.${key}`);
    for (const [group, table] of Object.entries(policy.limits.groups))
        for (const key of Object.keys(table)) keys.push(`limits.${group}.${key}`);
    return keys;
}

function scalarKeys(prefix: string, table: NamingCategoryTable): string[] {
    return NAMING_SCALARS.filter((key) => table[key] !== undefined).map((key) => `${prefix}.${key}`);
}

function namingKeys(policy: Partial<Policy>): string[] {
    if (!policy.naming) return [];
    const keys: string[] = [];
    for (const [language, table] of Object.entries(policy.naming.languages)) {
        keys.push(...scalarKeys(`naming.${language}`, table));
        for (const [category, inner] of Object.entries(table.categories))
            keys.push(...scalarKeys(`naming.${language}.${category}`, inner));
    }
    return keys;
}

function toolKeys(policy: Partial<Policy>, surface: ExposedSettings): string[] {
    const keys: string[] = [];
    const pending = Object.entries(policy.tools ?? {}).flatMap(([tool, table]) =>
        Object.entries(table)
            .filter(([slot]) => slot !== 'extra')
            .map(([slot, value]) => ({ key: `tools.${tool}.${slot}`, value })),
    );
    for (const { key, value } of pending) {
        const children = Array.isArray(value) ? undefined : asRecord(value);
        if (
            !surface.specs.has(key) &&
            children !== undefined &&
            [...surface.specs.keys()].some((name) => name.startsWith(`${key}.`))
        ) {
            pending.push(...Object.entries(children).map(([slot, child]) => ({ key: `${key}.${slot}`, value: child })));
        } else keys.push(key);
    }
    return keys;
}

function addDefault(surface: ExposedSettings, manifest: Manifest, spec: SettingSpec): void {
    if (spec.default === undefined) return;
    const previous = surface.defaults.get(spec.name);
    const isConflict =
        previous !== undefined &&
        previous.configuration !== manifest.configuration.name &&
        JSON.stringify(previous.value) !== JSON.stringify(spec.default);
    const isList = surface.specs.get(spec.name)?.kind === 'list';
    if (!isList && isConflict && !OVERRIDING_KINDS.has(manifest.configuration.kind)) {
        surface.problems.push({
            key: spec.name,
            message: messages.conflictingScalars(spec.name, previous.configuration, manifest.configuration.name),
        });
        return;
    }
    surface.defaults.set(spec.name, {
        value: isList ? mergeValue(spec, previous?.value, spec.default) : spec.default,
        configuration: manifest.configuration.name,
    });
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
    if (table !== 'naming' || rest.length !== 2) return undefined;
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

function mergeValue(spec: SettingSpec, current: unknown, found: unknown): unknown {
    if (spec.kind === 'list' && Array.isArray(current) && Array.isArray(found))
        return [...new Set([...(current as unknown[]), ...(found as unknown[])])];
    if (spec.kind === 'table' && spec.direction === 'per-rule') return { ...asRecord(current), ...asRecord(found) };
    return found;
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

/**
 * The root policy and applicable scope tables, ordered from outermost to innermost.
 * @param policy
 * @param scope
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
 * Narrows a value to a plain object.
 * @param value anything
 * @returns the value as a record, or undefined for primitives and null
 */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

/**
 * Every setting key a policy table writes, in dotted form.
 * @param policy the root table or one scope table
 * @param surface the selected manifest settings, including nested tool keys
 * @returns the keys under limits, naming, tools and format
 */
export function writtenKeys(policy: Partial<Policy>, surface: ExposedSettings): string[] {
    const format = Object.keys(policy.format ?? {}).map((key) => `format.${key}`);
    return [...limitKeys(policy), ...namingKeys(policy), ...toolKeys(policy, surface), ...format];
}

/**
 * Builds the surface in selection order; framework, platform, library, and database configurations override scalar defaults.
 * @param selected the manifests of the selection, in order
 * @returns the specs, their defaults and the conflicts found on the way
 */
export function exposedSettings(selected: Manifest[]): ExposedSettings {
    const surface: ExposedSettings = { specs: new Map(), defaults: new Map(), problems: [] };
    for (const spec of [TOOL_DEADLINE, COVERAGE_STRICT]) {
        surface.specs.set(spec.name, spec);
        surface.defaults.set(spec.name, { value: spec.default, configuration: 'gspot' });
    }
    for (const [name, schema] of Object.entries({
        ...rootSettingSchemas,
        ...integrationSettingSchemas,
    })) {
        const value = schema.parse(undefined);
        const spec: SettingSpec = {
            name,
            kind: Array.isArray(value) ? 'list' : typeof value === 'boolean' ? 'boolean' : 'string',
            direction: 'neutral',
            default: value,
            summary: schema.description ?? '',
        };
        surface.specs.set(name, spec);
        surface.defaults.set(name, { value: spec.default, configuration: 'gspot' });
    }
    for (const manifest of selected) {
        for (const spec of manifest.settings) {
            if (!surface.specs.has(spec.name)) surface.specs.set(spec.name, spec);
            addDefault(surface, manifest, spec);
        }
    }
    return surface;
}

/**
 * Matches a written key to the spec it belongs to: per-language and per-category variants map back to their base spec.
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
    if (key === 'generated' || key === 'vendored')
        return plainIfPresent(
            policy.declarations?.filter((entry) => entry.nature === key).map(({ nature, ...entry }) => entry),
        );
    if (key === 'require_reasons') return plainIfPresent(policy.requireReasons);
    if (key === 'extra_checks') return plainIfPresent(policy.extraChecks);
    if (table === 'limits') return limitValue(policy, rest);
    if (table === 'naming') return namingValue(policy, rest);
    if (table === undefined) return undefined;
    return plainIfPresent(walk(asRecord(policy)?.[table], rest));
}

/**
 * Resolves one key: configuration default, root table, scope table. Lists append and deduplicate; scalars replace.
 * @param surface the surface of the selection
 * @param policy the loaded policy
 * @param key the dotted key
 * @param scope the scope path whose table applies last, if any
 * @returns the value with where it came from, or undefined when nothing exposes the key
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
    const start: SettingState = {
        value: shipped?.value,
        source: shipped ? `configuration ${shipped.configuration}` : 'unset',
        reason: undefined,
    };
    const candidates = match.language === undefined ? [key] : [spec.name, key];
    const { value, source, reason } = applyLayers(spec, key, start, policyTables(policy, scope), candidates);
    return {
        key,
        spec,
        value,
        source,
        ...(reason === undefined ? {} : { reason }),
        ...(scope === undefined ? {} : { scope }),
    };
}

/**
 * Every setting the surface exposes, resolved, for list settings and the docs.
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

export type ResolvedSetting = {
    key: string;
    spec: SettingSpec;
    value: unknown;
    reason?: string;
    source: string;
    scope?: string;
};

export type ExposedSettings = {
    specs: Map<string, SettingSpec>;
    defaults: Map<string, { value: unknown; configuration: string }>;
    problems: { key: string; message: string }[];
};

/** A written value with its reason, once the reasoned form is unwrapped. */
export type WrittenValue = { value: unknown; reason?: string };

/** One layer of policy that a key is resolved through: the root table or one scope table. */
export type PolicyLayer = { table: Partial<Policy>; name: string };

/** A written key matched to its spec, with the language and category the key names. */
export type SpecMatch = { spec: SettingSpec; language?: string; category?: string };

/** Where a resolved value stands after some layers were applied. */
export type SettingState = { value: unknown; source: string; reason: string | undefined };

/** What resolving a value for one scope needs. */
export type PolicyScopeLayer = { surface: ExposedSettings; policy: Policy; scope: string };

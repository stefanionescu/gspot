import { compact, isRecord } from '#cli/platform/text.ts';
import { CATEGORY_KEYS, NAMING_LIST_KEYS, STRUCTURE_DEFAULTS } from '#cli/config/policy/policy.ts';

import type {
    Limits,
    Policy,
    RawScope,
    Reasoned,
    RawLimits,
    RawNaming,
    RawPolicy,
    NamingSettings,
    NamingCategoryTable,
    NamingLanguageTable,
} from '#cli/types/policy/policy.ts';

function isReasonedForm(value: unknown): value is { value: unknown; reason: string } {
    return isRecord(value) && 'value' in value && 'reason' in value;
}

function normalizeCategory(raw: Record<string, unknown>): NamingCategoryTable {
    const table: NamingCategoryTable = {};
    if (raw['max_chars'] !== undefined) table.max_chars = toReasoned(raw['max_chars'] as number);
    if (raw['max_words'] !== undefined) table.max_words = toReasoned(raw['max_words'] as number);
    if (raw['case'] !== undefined) table.case = toReasoned(raw['case'] as string[]);
    return table;
}

function normalizeLanguage(table: Record<string, unknown>): NamingLanguageTable {
    const language: NamingLanguageTable = { ...normalizeCategory(table), categories: {} };
    for (const [inner, entry] of Object.entries(table))
        if (!CATEGORY_KEYS.has(inner) && isRecord(entry)) language.categories[inner] = normalizeCategory(entry);
    return language;
}

function normalizeScopeTables(raw: RawScope): Partial<Policy> {
    const table: Partial<Policy> = {};
    if (raw.limits) table.limits = normalizeLimits(raw.limits);
    if (raw.naming) table.naming = normalizeNaming(raw.naming);
    if (raw.architecture) table.architecture = normalizeArchitecture(raw.architecture);
    if (raw.structure) table.structure = defaulted<Policy['structure']>(raw.structure, STRUCTURE_DEFAULTS);
    if (raw.tools) table.tools = raw.tools as Policy['tools'];
    if (raw.format) table.format = compact(raw.format);
    return table;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two normalizers fill defaults over the written keys; the generic keeps the table type.
function defaulted<T extends object>(raw: object | undefined, defaults: T): T {
    const written: Partial<T> = compact(raw ?? {});
    return { ...defaults, ...written };
}

function trimTrailingSlashes(path: string): string {
    let end = path.length;
    while (end > 0 && path[end - 1] === '/') end -= 1;
    return path.slice(0, end);
}

/**
 * Wraps a bare value or a { value, reason } table into the reasoned form.
 * @param value the value as written
 * @returns the value with its reason when it had one
 */
function toReasoned<T>(value: T | { value: T; reason: string }): Reasoned<T> {
    if (isReasonedForm(value)) return { value: value.value, reason: value.reason };
    return { value: value };
}

/**
 * Splits [limits] into root limits and per-language groups, every value reasoned.
 * @param raw the table as written, if any
 * @returns the limits
 */
function normalizeLimits(raw: RawLimits | undefined): Limits {
    const limits: Limits = { root: {}, groups: {} };
    const entries = Object.entries(raw ?? {});
    for (const [key, value] of entries) {
        if (!isRecord(value) || 'value' in value) {
            limits.root[key] = toReasoned(value as number | { value: number; reason: string });
            continue;
        }
        limits.groups[key] = Object.fromEntries(
            Object.entries(value)
                .filter(([, entry]) => entry !== undefined)
                .map(([inner, entry]) => [inner, toReasoned(entry as number)]),
        );
    }
    return limits;
}

/**
 * Fills the naming lists and splits the per-language tables from the list keys.
 * @param raw the table as written, if any
 * @returns the naming configuration
 */
function normalizeNaming(raw: RawNaming | undefined): NamingSettings {
    const lists = defaulted(raw, {
        banned_terms: [],
        allowed: [],
        external: [],
        reserved: [],
        remove_groups: [],
        contract_properties: [],
    });
    const naming: NamingSettings = {
        banned_terms: lists.banned_terms,
        allowed: lists.allowed,
        external: lists.external,
        reserved: lists.reserved,
        remove_groups: lists.remove_groups,
        contract_properties: lists.contract_properties,
        languages: {},
        rules: (raw?.rules ?? []).map((entry) => compact(entry)),
    };
    const entries = Object.entries(raw ?? {});
    for (const [key, value] of entries)
        if (!NAMING_LIST_KEYS.has(key) && isRecord(value)) naming.languages[key] = normalizeLanguage(value);
    return naming;
}

/**
 * Fills the architecture table's lists and keeps its optional keys only when written.
 * @param raw the table as written, if any
 * @returns the architecture configuration
 */

function normalizeArchitecture(raw: RawPolicy['architecture']): Policy['architecture'] {
    const filled = defaulted(raw, { elements: [], edges_allowed: [], roles: {}, contracts: [] });
    return compact({ ...filled, edges_allowed: filled.edges_allowed.map((entry) => compact(entry)) });
}

/**
 * The whole document in Policy shape.
 * @param raw the validated document
 * @returns the policy
 */
export function normalize(raw: RawPolicy): Policy {
    const scopeTables: Record<string, Partial<Policy>> = {};
    const scopes = raw.scope ?? [];
    for (const scope of scopes) scopeTables[trimTrailingSlashes(scope.path)] = normalizeScopeTables(scope);
    return {
        level: raw.level,
        requireReasons: raw.require_reasons,
        extraChecks: raw.extra_checks,
        exclude: raw.exclude,
        kits: raw.kits ?? [],
        scopes: scopes.map((scope) => ({
            path: trimTrailingSlashes(scope.path),
            kits: scope.kits ?? [],
        })),
        limits: normalizeLimits(raw.limits),
        naming: normalizeNaming(raw.naming),
        architecture: normalizeArchitecture(raw.architecture),
        structure: defaulted<Policy['structure']>(raw.structure, STRUCTURE_DEFAULTS),
        format: compact({ ...raw.format }),
        prose: defaulted<Policy['prose']>(raw.prose, { vocabulary: [] }),
        tools: { ...raw.tools } as Policy['tools'],
        ignores: (raw.ignore ?? []).map((entry) => compact(entry)),
        declarations: [
            ...raw.generated.map((entry) => ({ ...entry, kind: 'generated' as const })),
            ...raw.vendored.map((entry) => ({ ...entry, kind: 'vendored' as const })),
        ],
        checks: (raw.check ?? []).map((entry) => compact({ ...entry, output: entry.output && compact(entry.output) })),

        ...compact({ hooks: raw.hooks, ci: raw.ci }),
        guides: defaulted<Policy['guides']>(raw.guides, { install: true, directory: '.gspot/guides', exclude: [] }),
        ...(raw.runner === undefined ? {} : { runner: { tool: raw.runner.tool } }),
        scopeTables,
    };
}

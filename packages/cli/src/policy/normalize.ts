// From the validated raw document to the Policy shape: reasoned values unwrapped, defaults filled, scopes split.

import type {
    RawLimits,
    RawNaming,
    RawPolicy,
    RawScope,
    Defined,
    Limits,
    NamingCategoryTable,
    NamingSettings,
    NamingLanguageTable,
    Policy,
    Reasoned,
} from '#types/config.ts';

const NAMING_LIST_KEYS = new Set([
    'banned_terms',
    'allowed',
    'external',
    'reserved',
    'remove_groups',
    'contract_properties',
    'rules',
]);

const CATEGORY_KEYS = new Set(['max_chars', 'max_words', 'case']);

function isTable(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReasonedForm(value: unknown): value is { value: unknown; reason: string } {
    return isTable(value) && 'value' in value && 'reason' in value;
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
        if (!CATEGORY_KEYS.has(inner) && isTable(entry)) language.categories[inner] = normalizeCategory(entry);
    return language;
}

function normalizeScopeTables(raw: RawScope): Partial<Policy> {
    const table: Partial<Policy> = {};
    if (raw.limits) table.limits = normalizeLimits(raw.limits);
    if (raw.naming) table.naming = normalizeNaming(raw.naming);
    if (raw.architecture) table.architecture = normalizeArchitecture(raw.architecture);
    if (raw.structure) table.structure = normalizeStructure(raw.structure);
    if (raw.tools) table.tools = raw.tools as Policy['tools'];
    if (raw.format) table.format = compact(raw.format);
    return table;
}

function defaulted<T extends object>(raw: object | undefined, defaults: T): T {
    const written: Partial<T> = compact(raw ?? {});
    return { ...defaults, ...written };
}

function trimTrailingSlashes(path: string): string {
    let end = path.length;
    while (end > 0 && path[end - 1] === '/') end -= 1;
    return path.slice(0, end);
}

function normalizeScalars(raw: RawPolicy): Pick<Policy, 'hooks' | 'ci' | 'rules' | 'editor' | 'inspection' | 'runner'> {
    return {
        hooks: defaulted<Policy['hooks']>(raw.hooks, { tool: 'gspot' }),
        ci: defaulted<Policy['ci']>(raw.ci, { provider: 'none', platforms: ['ubuntu'] }),
        rules: defaulted<Policy['rules']>(raw.rules, { install: true, directory: '.gspot/rules', exclude: [] }),
        editor: defaulted<Policy['editor']>(raw.editor, { vscode: false }),
        inspection: defaulted<Policy['inspection']>(raw.inspection, { strict: false }),
        runner: defaulted<Policy['runner']>(raw.runner, { surface: 'none' }),
    };
}

/**
 * Drops the undefined entries of an object, so exact optional types hold.
 * @param value any object
 * @returns the same object without its undefined entries
 */
export function compact<T extends object>(value: T): Defined<T> {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Defined<T>;
}

/**
 * Compacts every object of a list; a missing list is empty.
 * @param entries the entries as written
 * @returns the compacted objects
 */
export function compactAll<T extends object>(entries: T[] | undefined): Defined<T>[] {
    return (entries ?? []).map((value) => compact(value));
}

/**
 * Wraps a bare value or a { value, reason } table into the reasoned form.
 * @param value the value as written
 * @returns the value with its reason when it had one
 */
export function toReasoned<T>(value: T | { value: T; reason: string }): Reasoned<T> {
    if (isReasonedForm(value)) return { value: value.value, reason: value.reason };
    return { value: value };
}

/**
 * Splits [limits] into root limits and per-language groups, every value reasoned.
 * @param raw the table as written, if any
 * @returns the limits
 */
export function normalizeLimits(raw: RawLimits | undefined): Limits {
    const limits: Limits = { root: {}, groups: {} };
    const entries = Object.entries(raw ?? {});
    for (const [key, value] of entries) {
        if (isTable(value) && !('value' in value)) {
            const group: Record<string, Reasoned<number>> = {};
            for (const [inner, entry] of Object.entries(value)) group[inner] = toReasoned(entry);
            limits.groups[key] = group;
        } else limits.root[key] = toReasoned(value as number | { value: number; reason: string });
    }
    return limits;
}

/**
 * Fills the naming lists and splits the per-language tables from the list keys.
 * @param raw the table as written, if any
 * @returns the naming configuration
 */
export function normalizeNaming(raw: RawNaming | undefined): NamingSettings {
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
        rules: compactAll(raw?.rules),
    };
    const entries = Object.entries(raw ?? {});
    for (const [key, value] of entries)
        if (!NAMING_LIST_KEYS.has(key) && isTable(value)) naming.languages[key] = normalizeLanguage(value);
    return naming;
}

/**
 * Fills the architecture table's lists and keeps its optional keys only when written.
 * @param raw the table as written, if any
 * @returns the architecture configuration
 */
export function normalizeArchitecture(raw: RawPolicy['architecture']): Policy['architecture'] {
    const filled = defaulted(raw, { elements: [], edges_allowed: [], roles: {}, contracts: [], imports_allowed: [] });
    return compact({ ...filled, edges_allowed: compactAll(filled.edges_allowed) });
}

/**
 * Fills the structure table's defaults.
 * @param raw the table as written, if any
 * @returns the structure configuration
 */
export function normalizeStructure(raw: RawPolicy['structure']): Policy['structure'] {
    const filled = defaulted<Policy['structure']>(raw, {
        reexports: 'none',
        call_through_allowed: [],
        trivial_allowed: [],
        single_file_folder_allowed: [],
        prefix_collision_allowed: [],
        folder_name_allowed: [],
        python: {},
    });
    return { ...filled, trivial_allowed: compactAll(filled.trivial_allowed) };
}

/**
 * The whole document in Policy shape.
 * @param raw the validated document
 * @returns the policy
 */
export function normalize(raw: RawPolicy): Policy {
    const scopeTables: Record<string, Partial<Policy>> = {};
    const scopes = raw.scope ?? [];
    for (const scope of scopes) scopeTables[scope.path] = normalizeScopeTables(scope);
    return {
        version: raw.version,
        presets: raw.presets ?? [],
        scopes: scopes.map((scope) => ({ path: trimTrailingSlashes(scope.path), presets: scope.presets ?? [] })),
        limits: normalizeLimits(raw.limits),
        naming: normalizeNaming(raw.naming),
        architecture: normalizeArchitecture(raw.architecture),
        structure: normalizeStructure(raw.structure),
        format: compact(raw.format ?? {}),
        prose: defaulted<Policy['prose']>(raw.prose, { vocabulary: [], disabled: [] }),
        tools: (raw.tools ?? {}) as Policy['tools'],
        ignores: compactAll(raw.ignore),
        declares: compactAll(raw.declare),
        checks: (raw.check ?? []).map((entry) => compact({ ...entry, output: entry.output && compact(entry.output) })),
        ...normalizeScalars(raw),
        scopeTables,
    };
}

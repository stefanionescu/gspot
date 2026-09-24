// From the validated raw document to the Policy shape: reasoned values unwrapped, defaults filled, scopes split.

import type { RawPolicy, RawScope, Defined } from '#cli/policy/schema.ts';

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
            for (const [inner, entry] of Object.entries(value))
                if (entry !== undefined) group[inner] = toReasoned(entry);
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
    const filled = defaulted(raw, { elements: [], edges_allowed: [], roles: {}, contracts: [] });
    return compact({ ...filled, edges_allowed: compactAll(filled.edges_allowed) });
}

/**
 * Fills the structure table's defaults.
 * @param raw the table as written, if any
 * @returns the structure configuration
 */
export function normalizeStructure(raw: RawPolicy['structure']): Policy['structure'] {
    return defaulted<Policy['structure']>(raw, {
        reexports: 'none',
        single_file_folder_allowed: [],
        prefix_collision_allowed: [],
        folder_name_allowed: [],
        python: {},
    });
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
        version: raw.version,
        level: raw.level,
        requireReasons: raw.require_reasons,
        extraChecks: raw.extra_checks,
        exclude: raw.exclude,
        configurations: raw.configurations ?? [],
        scopes: scopes.map((scope) => ({
            path: trimTrailingSlashes(scope.path),
            configurations: scope.configurations ?? [],
        })),
        limits: normalizeLimits(raw.limits),
        naming: normalizeNaming(raw.naming),
        architecture: normalizeArchitecture(raw.architecture),
        structure: normalizeStructure(raw.structure),
        format: compact(raw.format ?? {}),
        prose: defaulted<Policy['prose']>(raw.prose, { vocabulary: [] }),
        tools: (raw.tools ?? {}) as Policy['tools'],
        ignores: compactAll(raw.ignore),
        declarations: [
            ...raw.generated.map((entry) => ({ ...entry, nature: 'generated' as const })),
            ...raw.vendored.map((entry) => ({ ...entry, nature: 'vendored' as const })),
        ],
        checks: (raw.check ?? []).map((entry) => compact({ ...entry, output: entry.output && compact(entry.output) })),

        ...(raw.hooks === undefined ? {} : { hooks: raw.hooks }),
        ...(raw.ci === undefined ? {} : { ci: raw.ci }),
        rules: defaulted<Policy['rules']>(raw.rules, { install: true, directory: '.gspot/rules', exclude: [] }),
        coverage: defaulted<Policy['coverage']>(raw.coverage, { strict: false }),
        ...(raw.runner === undefined
            ? {}
            : {
                  runner: {
                      tool: raw.runner.tool,
                      ...(raw.runner.tasks === undefined ? {} : { tasks: raw.runner.tasks }),
                  },
              }),
        scopeTables,
    };
}

export type Reasoned<T> = { value: T; reason?: string };

export type LimitTable = Record<string, Reasoned<number>>;

export type Limits = {
    root: LimitTable;
    groups: Record<string, LimitTable>;
};

export type NamingCategoryTable = {
    max_chars?: Reasoned<number>;
    max_words?: Reasoned<number>;
    case?: Reasoned<string[]>;
};

export type NamingLanguageTable = NamingCategoryTable & {
    categories: Record<string, NamingCategoryTable>;
};

export type NamingRule = {
    paths: string[];
    languages?: string[];
    categories?: string[];
    names?: string[];
    structural_prefix?: string;
    allow_digits?: boolean;
    allow_duplicate_words?: boolean;
    exclude?: boolean;
    case?: string[];
    reason?: string;
};

export type NamingSettings = {
    banned_terms: string[];
    allowed: { name: string; reason?: string }[];
    external: string[];
    reserved: { term: string; allowed_for: string[] }[];
    remove_groups: { group: string; reason?: string }[];
    contract_properties: { file: string; names: string[] }[];
    languages: Record<string, NamingLanguageTable>;
    rules: NamingRule[];
};

export type ArchitectureElement = { name: string; paths: string[] };

export type ArchitectureAllow = { from: string; to: string[]; reason?: string };

export type ArchitectureSettings = {
    types_directory?: string;
    elements: ArchitectureElement[];
    edges_allowed: ArchitectureAllow[];
    roles: Record<string, string | string[]>;
    contracts: Record<string, unknown>[];
};

export type StructureSettings = {
    reexports: 'none' | 'index-only';
    single_file_folder_allowed: { paths: string[]; reason?: string }[];
    prefix_collision_allowed: { paths: string[]; reason?: string }[];
    folder_name_allowed: { paths: string[]; reason?: string }[];
    python: Record<string, unknown>;
};

export type FormatSettings = Required<Defined<Omit<NonNullable<RawPolicy['format']>, 'overrides'>>>;

export type ToolTable = Record<string, unknown> & {
    extra?: Record<string, unknown> & { reason?: string };
};

export type IgnoreEntry = NonNullable<RawPolicy['ignore']>[number];

export type FileDeclaration =
    | (RawPolicy['generated'][number] & { nature: 'generated' })
    | (RawPolicy['vendored'][number] & { nature: 'vendored' });

export type RepositoryCheck = Defined<NonNullable<RawPolicy['check']>[number]>;

export type ScopeEntry = { path: string; configurations: string[] };

export type Policy = {
    version: number;
    level: RawPolicy['level'];
    requireReasons: RawPolicy['require_reasons'];
    extraChecks: string[];
    exclude: RawPolicy['exclude'];
    configurations: string[];
    scopes: ScopeEntry[];
    limits: Limits;
    naming: NamingSettings;
    architecture: ArchitectureSettings;
    structure: StructureSettings;
    format: Defined<NonNullable<RawPolicy['format']>>;
    prose: { vocabulary: string[] };
    tools: Record<string, ToolTable>;
    ignores: IgnoreEntry[];
    declarations: FileDeclaration[];
    checks: RepositoryCheck[];
    hooks?: Defined<NonNullable<RawPolicy['hooks']>>;
    ci?: NonNullable<RawPolicy['ci']>;
    rules: { install: boolean; directory: string; project?: string; exclude: string[]; agents?: string[] };
    coverage: { strict: boolean };
    runner?: Defined<NonNullable<RawPolicy['runner']>>;
    scopeTables: Record<string, Partial<Policy>>;
};

/** The [limits] table as written. */
export type RawLimits = NonNullable<RawPolicy['limits']>;

/** The [naming] table as written. */
export type RawNaming = NonNullable<RawPolicy['naming']>;

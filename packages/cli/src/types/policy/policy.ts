// The types of policy in this package.
import type { z } from 'zod';
import type { RuleSettings } from '#cli/types/rules.ts';
import type { Defined } from '#cli/types/platform/platform.ts';
import type { scopeSchema, policySchema } from '#cli/policy/schema.ts';
import type { Manifest, PolicyScope, SettingSpec } from '#cli/types/kits.ts';
import type { ScopeEntry, FileDeclaration } from '#cli/types/repository/repository.ts';

type ArchitectureAllow = { from: string; to: string[]; reason?: string };

type StructureSettings = {
    reexports: 'none' | 'index-only';
    lone_files_allowed: { paths: string[]; reason?: string }[];
    prefix_collisions_allowed: { paths: string[]; reason?: string }[];
    folder_names_allowed: { paths: string[]; reason?: string }[];
    python: Record<string, unknown>;
};

type LimitTable = Record<string, Reasoned<number>>;

/** The shipped policy file, kits/general/naming/policy.json. */
export type ShippedPolicy = {
    version: number;
    matching: { wholeParts: boolean; caseInsensitive: boolean };
    banDigits: boolean;
    banDuplicateWords: boolean;
    groups: Record<string, { removable: boolean; terms: string[] }>;
    reserved: { term: string; allowedFor: string[] }[];
    external: string[];
    languages: Record<string, ShippedLanguage>;
    rules: ShippedRule[];
};

/** One language's table in the shipped policy. */
export type ShippedLanguage = {
    maxChars: number;
    maxWords: number;
    acronyms: 'word' | 'initialism' | 'lower';
    categories: Record<string, { case: string[] }>;
};

/** One path-scoped rule in the shipped policy. */
export type ShippedRule = {
    paths: string[];
    languages?: string[] | undefined;
    categories?: string[] | undefined;
    names?: string[] | undefined;
    exclude?: boolean | undefined;
    reason?: string | undefined;
    allowDigits?: boolean | undefined;
    allowDuplicateWords?: boolean | undefined;
    structuralPrefix?: string | undefined;
    case?: string[] | undefined;
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

export type ArchitectureElement = { name: string; paths: string[] };

export type ArchitectureSettings = {
    types_directory?: string;
    config_directory?: string;
    elements: ArchitectureElement[];
    edges_allowed: ArchitectureAllow[];
    roles: Record<string, string | string[]>;
    contracts: Record<string, unknown>[];
};

export type Policy = {
    level: RawPolicy['level'];
    requireReasons: RawPolicy['require_reasons'];
    extraChecks: string[];
    exclude: RawPolicy['exclude'];
    kits: string[];
    scopes: PolicyScope[];
    limits: Limits;
    naming: NamingSettings;
    architecture: ArchitectureSettings;
    structure: StructureSettings;
    format: Defined<NonNullable<RawPolicy['format']>>;
    prose: { vocabulary: string[] };
    tools: Record<string, ToolTable>;
    install: Record<string, unknown>;
    tests: string[];
    timeout?: NonNullable<RawPolicy['timeout']>;
    ignores: IgnoreEntry[];
    declarations: FileDeclaration[];
    checks: RepositoryCheck[];
    hooks?: Defined<NonNullable<RawPolicy['hooks']>>;
    ci?: NonNullable<RawPolicy['ci']>;
    rules: RuleSettings;
    runner?: NonNullable<RawPolicy['runner']>;
    scopeTables: Record<string, Partial<Policy>>;
};

export type PolicyFiles = {
    policy: Policy;
    path: string;
    text: string;
    /** The wrong entries reading dropped; empty for a policy every command accepts. */
    problems: PolicyProblem[];
};

/** gspot.toml as the schema accepts it, before normalization. */
export type RawPolicy = z.infer<typeof policySchema>;

/** One [[scope]] entry as written. */
export type RawScope = z.infer<typeof scopeSchema>;

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
    defaults: Map<string, { value: unknown; kit: string }>;
    problems: { key: string; message: string }[];
};

/** A written value with its reason, once the reasoned form is unwrapped. */
export type WrittenValue = { value: unknown; reason?: string };

/** One layer of policy that a key is resolved through: the root table or one scope table. */
export type PolicyLayer = { table: Partial<Policy>; name: string };

/** A written key matched to its specification and its declared language and category. */
export type SpecMatch = { spec: SettingSpec; language?: string; category?: string };

/** Where a resolved value stands after some layers were applied. */
export type SettingState = { value: unknown; source: string; reason: string | undefined };

/** What resolving a value for one scope needs. */
export type PolicyScopeLayer = { surface: ExposedSettings; policy: Policy; scope: string };

/** A node of the published JSON schema, as the loader walks it to name the keys a table accepts. */
export type SchemaNode = {
    type?: string;
    properties?: Record<string, SchemaNode>;
    items?: SchemaNode;
    additionalProperties?: SchemaNode | boolean;
    anyOf?: SchemaNode[];
};

/** An authored policy value and the semantic problem it caused. */
export type PolicyProblem = { path: PathSegment[]; message: string };

/** One step of a zod issue path. */
export type PathSegment = string | number;

export type Reasoned<T> = { value: T; reason?: string };
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

export type NamingSettings = {
    banned: string[];
    allowed: { name: string; reason?: string }[];
    external: string[];
    reserved: { term: string; allowed_for: string[] }[];
    dropped_groups: { group: string; reason?: string }[];
    protocol_keys: { file: string; names: string[] }[];
    languages: Record<string, NamingLanguageTable>;
    rules: NamingRule[];
};

export type FormatSettings = Required<Defined<Omit<NonNullable<RawPolicy['format']>, 'overrides'>>>;
export type ToolTable = Record<string, unknown> & {
    extra?: Record<string, unknown> & { reason?: string };
};
export type IgnoreEntry = NonNullable<RawPolicy['ignore']>[number];

export type RepositoryCheck = Defined<NonNullable<RawPolicy['check']>[number]>;

/** The [limits] table as written. */
export type RawLimits = NonNullable<RawPolicy['limits']>;

/** The [naming] table as written. */
export type RawNaming = NonNullable<RawPolicy['naming']>;
export type Mutation = (raw: TomlTable) => void;
export type WriteResult = { text: string; policy: Policy; changed: boolean };
export type ScopeSelection = {
    scope: ScopeEntry;
    selected: Manifest[];
    surface: ExposedSettings;
    view: MergedView;
};
export type MergedView = {
    scope: string;
    kits: string[];
    settings: Record<string, unknown>;
    reasons: Record<string, string>;
    format: FormatSettings;
    limit: (key: string, language?: string) => number | undefined;
    tool: (name: string) => Record<string, unknown>;
    ignoresFor: (check: string) => IgnoreEntry[];
    rulesOff: (check: string) => string[];
    extra: (name: string) => Record<string, unknown> | undefined;
};

export type TomlTable = Record<string, unknown>;

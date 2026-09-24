import type { z } from 'zod';
import type { SettingSpec } from '#cli/types/configurations.ts';
// The shape of gspot.toml after load: every reasoned key is normalized to { value, reason }.
import type { policySchema, scopeSchema } from '#cli/schemas/policy.ts';
import type { CarriedConfiguration, CarriedFormatter } from '#cli/types/ownership.ts';

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

export type PolicyFiles = {
    policy: Policy;
    path: string;
    text: string;
};

/** An authored policy value and the semantic problem it caused. */
export type PolicyProblem = { path: PathSegment[]; message: string };

export type TomlTable = Record<string, unknown>;

export type Defined<T> = { [K in keyof T]: Exclude<T[K], undefined> };

export type MergedView = {
    scope: string;
    configurations: string[];
    settings: Record<string, unknown>;
    reasons: Record<string, string>;
    format: FormatSettings;
    limit: (key: string, language?: string) => number | undefined;
    tool: (name: string) => Record<string, unknown>;
    ignoresFor: (check: string) => IgnoreEntry[];
    rulesOff: (check: string) => string[];
    extra: (name: string) => Record<string, unknown> | undefined;
};

export type Proposal = {
    profileTables?: TomlTable;
    configurations: string[];
    scopes: { path: string; configurations: string[] }[];
    carried: CarriedConfiguration;
    hooks: NonNullable<RawPolicy['hooks']>['tool'] | 'none';
    ci: NonNullable<RawPolicy['ci']>['provider'] | 'none';
    rules: boolean;
    runner: NonNullable<RawPolicy['runner']>['tool'] | 'none';
    runnerTasks?: NonNullable<RawPolicy['runner']>['tasks'];
    formatter?: CarriedFormatter;
    /** The Xcode project and scheme init found, for the tools.xcode table. */
    xcode?: { scope: string; project: string; scheme?: string };
    commitScopes?: string[];
};

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

export type Mutation = (raw: TomlTable) => void;

export type WriteResult = { text: string; policy: Policy; changed: boolean };

/** A written value with its reason, once the reasoned form is unwrapped. */
export type WrittenValue = { value: unknown; reason?: string };

/** One layer of policy that a key is resolved through: the root table or one scope table. */
export type PolicyLayer = { table: Partial<Policy>; name: string };

/** A written key matched to its spec, with the language and category the key names. */
export type SpecMatch = { spec: SettingSpec; language?: string; category?: string };

/** Where a resolved value stands after some layers were applied. */
export type SettingState = { value: unknown; source: string; reason: string | undefined };

/** A node of the published JSON schema, as the loader walks it to name the keys a table accepts. */
export type SchemaNode = {
    type?: string;
    properties?: Record<string, SchemaNode>;
    items?: SchemaNode;
    additionalProperties?: SchemaNode | boolean;
    anyOf?: SchemaNode[];
};

/** One step of a zod issue path. */
export type PathSegment = string | number;

/** gspot.toml as the schema accepts it, before normalization. */
export type RawPolicy = z.infer<typeof policySchema>;

export type EslintAdoption = NonNullable<NonNullable<NonNullable<RawPolicy['tools']>['eslint']>['adopted']>[number];

/** One [[scope]] entry as written. */
export type RawScope = z.infer<typeof scopeSchema>;

/** The [limits] table as written. */
export type RawLimits = NonNullable<RawPolicy['limits']>;

/** The [naming] table as written. */
export type RawNaming = NonNullable<RawPolicy['naming']>;

/** What resolving a value for one scope needs. */
export type PolicyScopeLayer = { surface: ExposedSettings; policy: Policy; scope: string };

export type SettingRow = {
    key: string;
    value: unknown;
    source: string;
    direction: string;
    scope?: string;
};

/** One `[tools.<tool>.extra]` table: the keys it sets and why. */
export type ExtraRow = { tool: string; keys: string[]; reason?: string; scope: string };

/** The settings listing. */
export type SettingsListing = { rows: SettingRow[]; extras: ExtraRow[] };

/** The `[tools.<tool>]` tables of one policy layer, as the settings listing reads them. */
export type ToolTables = Record<string, { extra?: Record<string, unknown> & { reason?: string } }>;

/** ESLint settings retain the validation shape of their policy owner. */
export type EslintSettings = NonNullable<NonNullable<RawPolicy['tools']>['eslint']>;

export type EslintRegistration = NonNullable<EslintAdoption['plugins']>[string];

export type EditorconfigAdoption = NonNullable<NonNullable<NonNullable<RawPolicy['tools']>['editorconfig']>['adopted']>;

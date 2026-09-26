// The types of policy in this package.
import type { z } from 'zod';
import type { parseDocument } from '@decimalturn/toml-patch';
import type { runnerTasksSchema } from '#cli/policy/runner.ts';
import type { policySchema, scopeSchema } from '#cli/policy/schema.ts';
import type { Manifest, SettingSpec } from '#cli/types/configurations.ts';
import type { ScopeEntry, TomlTable } from '#cli/types/repository/repository.ts';

export type PolicyFiles = {
    policy: Policy;
    path: string;
    text: string;
    /** The wrong entries reading dropped, each with its line; empty for a policy every command accepts. */
    problems: PolicyFinding[];
};
/** A wrong entry or key of gspot.toml, where it is, and what is wrong with it. */
export type PolicyFinding = PolicyProblem & { line: number; column: number };
export type Defined<T> = { [K in keyof T]: Exclude<T[K], undefined> };
/** gspot.toml as the schema accepts it, before normalization. */
export type RawPolicy = z.infer<typeof policySchema>;
export type EslintAdoption = NonNullable<NonNullable<NonNullable<RawPolicy['tools']>['eslint']>['adopted']>[number];
/** One [[scope]] entry as written. */
export type RawScope = z.infer<typeof scopeSchema>;
/** ESLint settings retain the validation shape of their policy owner. */
export type EslintSettings = NonNullable<NonNullable<RawPolicy['tools']>['eslint']>;
export type EslintRegistration = NonNullable<EslintAdoption['plugins']>[string];
export type EditorconfigAdoption = NonNullable<NonNullable<NonNullable<RawPolicy['tools']>['editorconfig']>['adopted']>;
export type TomlBlock = ReturnType<typeof parseDocument>['cst'][number];
export type KeyValue = Extract<TomlBlock, { type: 'KeyValue' }>;
export type Value = KeyValue['value'];
export type Position = Value['loc']['start'];
export type Edit = { start: number; end: number; replacement: string };
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
    constants_directory?: string;
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
export type PolicyScope = { path: string; configurations: string[] };
export type Policy = {
    version: number;
    level: RawPolicy['level'];
    requireReasons: RawPolicy['require_reasons'];
    extraChecks: string[];
    exclude: RawPolicy['exclude'];
    configurations: string[];
    scopes: PolicyScope[];
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
export type Mutation = (raw: TomlTable) => void;
export type WriteResult = { text: string; policy: Policy; changed: boolean };
export type ScopeSelection = {
    scope: ScopeEntry;
    selected: Manifest[];
    surface: ExposedSettings;
    view: MergedView;
};
export type RunnerTaskNames = z.infer<typeof runnerTasksSchema>;
export type RunnerTask = { name: string; description: string; run: string };
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
export type Located<T> = { value: T; path: PathSegment[] };
export type ModuleReference = { module: string };

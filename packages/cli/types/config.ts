import type { z } from 'zod';
// The shape of gspot.toml after load: every reasoned key is normalized to { value, reason }.
import type { CarriedLists } from '#types/lifecycle.ts';
import type { policySchema, scopeSchema } from '#cli/policy/schema.ts';
import type { OutputFormat, SettingSpec, FixOrder } from '#types/manifest.ts';

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
    allowed: { name: string; reason: string }[];
    external: string[];
    reserved: { term: string; allowed_for: string[] }[];
    remove_groups: { group: string; reason: string }[];
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
    package_roots?: string[];
    route_directories?: string[];
    shared_directories?: string[];
    feature_contracts?: string[];
    imports_allowed: { from: string; to: string; reason: string }[];
};

export type StructureSettings = {
    reexports: 'none' | 'index-only';
    call_through_allowed: { file: string; name: string; reason: string }[];
    trivial_allowed: { language?: string; path: string; names: string[]; reason: string }[];
    single_file_folder_allowed: { paths: string[]; reason: string }[];
    prefix_collision_allowed: { paths: string[]; reason: string }[];
    folder_name_allowed: { paths: string[]; reason: string }[];
    python: Record<string, unknown>;
};

export type FormatSettings = {
    indent_style: 'space' | 'tab';
    indent_width: number;
    print_width: number;
    line_ending: 'lf' | 'crlf';
    newline_at_end: boolean;
    quotes: 'single' | 'double';
    trailing_comma: 'all' | 'es5' | 'none';
    semicolons: boolean;
};

export type ToolTable = Record<string, unknown> & {
    enabled?: Reasoned<boolean>;
    extra?: Record<string, unknown> & { reason: string };
};

export type IgnoreEntry = {
    check: string;
    rule?: string;
    finding?: string;
    paths?: string[];
    reason: string;
};

export type DeclareEntry = {
    paths: string[];
    produced_by?: string;
    vendored?: boolean;
    reason?: string;
};

export type RepositoryCheck = {
    id: string;
    command: string[];
    paths: string[];
    stage: 'commit' | 'push' | 'manual';
    help?: string;
    fix_command?: string[];
    fix_order?: FixOrder;
    count_regex?: string;
    requires?: 'build' | 'docker' | 'network';
    platform?: string[];
    summary?: string;
    output?: OutputFormat;
};

export type ScopeEntry = { path: string; presets: string[] };

export type Policy = {
    version: number;
    presets: string[];
    scopes: ScopeEntry[];
    limits: Limits;
    naming: NamingSettings;
    architecture: ArchitectureSettings;
    structure: StructureSettings;
    format: Partial<FormatSettings>;
    prose: { vocabulary: string[]; disabled: { rule: string; reason: string }[] };
    tools: Record<string, ToolTable>;
    ignores: IgnoreEntry[];
    declares: DeclareEntry[];
    checks: RepositoryCheck[];
    hooks: { tool: 'gspot' | 'lefthook' | 'husky' | 'none' };
    ci: { provider: 'github' | 'none'; platforms: string[] };
    rules: { install: boolean; directory: string; project?: string; exclude: string[] };
    editor: { vscode: boolean };
    inspection: { strict: boolean };
    runner: { surface: 'mise' | 'npm' | 'bun' | 'pnpm' | 'uv' | 'none' };
    scopeTables: Record<string, Partial<Policy>>;
};

export type LocalPolicy = { skip: string[] };

export type PolicyFiles = {
    policy: Policy;
    local: LocalPolicy;
    path: string;
    text: string;
};

export type TomlTable = Record<string, unknown>;

export type Defined<T> = { [K in keyof T]: Exclude<T[K], undefined> };

export type MergedView = {
    scope: string;
    presets: string[];
    settings: Record<string, unknown>;
    reasons: Record<string, string>;
    format: FormatSettings;
    limit: (key: string, language?: string) => number | undefined;
    tool: (name: string) => Record<string, unknown>;
    toolEnabled: (name: string) => boolean;
    ignoresFor: (check: string) => IgnoreEntry[];
    rulesOff: (check: string) => string[];
    extra: (name: string) => Record<string, unknown> | undefined;
};

export type Proposal = {
    profileTables?: TomlTable;
    presets: string[];
    scopes: { path: string; presets: string[] }[];
    carried: CarriedLists;
    hooks: 'gspot' | 'lefthook' | 'husky' | 'none';
    ci: 'github' | 'none';
    rules: boolean;
    runner: 'mise' | 'npm' | 'bun' | 'pnpm' | 'uv' | 'none';
    format?: Partial<FormatSettings>;
    typesDirectory?: string;
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
    defaults: Map<string, { value: unknown; preset: string }>;
    problems: string[];
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
    properties?: Record<string, SchemaNode>;
    items?: SchemaNode;
    additionalProperties?: SchemaNode | boolean;
    anyOf?: SchemaNode[];
};

/** One step of a zod issue path. */
export type PathSegment = string | number;

/** gspot.toml as the schema accepts it, before normalization. */
export type RawPolicy = z.infer<typeof policySchema>;

/** One [[scope]] entry as written. */
export type RawScope = z.infer<typeof scopeSchema>;

/** The [limits] table as written. */
export type RawLimits = NonNullable<RawPolicy['limits']>;

/** The [naming] table as written. */
export type RawNaming = NonNullable<RawPolicy['naming']>;

/** The task-runner surfaces gspot can write. */
export type RunnerSurface = 'mise' | 'npm' | 'bun' | 'pnpm' | 'uv' | 'none';

/** What resolving a value for one scope needs. */
export type PolicyScopeLayer = { surface: ExposedSettings; policy: Policy; scope: string };

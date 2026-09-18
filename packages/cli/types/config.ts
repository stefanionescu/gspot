// The shape of gspot.toml after load: every reasoned key is normalized to { value, reason }.

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

export type NamingConfig = {
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

export type ArchitectureConfig = {
    types_directory?: string;
    elements: ArchitectureElement[];
    allow: ArchitectureAllow[];
    roles: Record<string, string | string[]>;
    contracts: Record<string, unknown>[];
    package_roots?: string[];
    route_directories?: string[];
    shared_directories?: string[];
    feature_contracts?: string[];
    allowed_imports: { from: string; to: string; reason: string }[];
};

export type StructureConfig = {
    reexports: 'none' | 'index-only';
    call_through_allowed: { file: string; name: string; reason: string }[];
    trivial_exemptions: { language?: string; path: string; names: string[]; reason: string }[];
    single_file_folder_allowed: { paths: string[]; reason: string }[];
    prefix_collision_allowed: { paths: string[]; reason: string }[];
    folder_name_allowed: { paths: string[]; reason: string }[];
    python: Record<string, unknown>;
};

export type FormatConfig = {
    indent_style: 'space' | 'tab';
    indent_width: number;
    print_width: number;
    line_ending: 'lf' | 'crlf';
    final_newline: boolean;
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
    fix?: string[];
    count_regex?: string;
    requires?: 'build' | 'docker' | 'network';
    platform?: string[];
    summary?: string;
};

export type ScopeEntry = { path: string; presets: string[] };

export type Policy = {
    version: number;
    presets: string[];
    scopes: ScopeEntry[];
    limits: Limits;
    naming: NamingConfig;
    architecture: ArchitectureConfig;
    structure: StructureConfig;
    format: Partial<FormatConfig>;
    prose: { vocabulary: string[]; disabled: { rule: string; reason: string }[] };
    tools: Record<string, ToolTable>;
    ignores: IgnoreEntry[];
    declares: DeclareEntry[];
    checks: RepositoryCheck[];
    hooks: { manager: 'gspot' | 'lefthook' | 'husky' | 'none' };
    ci: { provider: 'github' | 'none'; platforms: string[] };
    rules: { install: boolean; directory: string; project?: string };
    editor: { vscode: boolean };
    coverage: { strict: boolean };
    runner: { surface: 'mise' | 'npm' | 'bun' | 'pnpm' | 'uv' | 'none' };
    scopeTables: Record<string, Partial<Policy>>;
};

export type LocalPolicy = { skip: string[] };

export type LoadedPolicy = {
    policy: Policy;
    local: LocalPolicy;
    path: string;
    text: string;
};

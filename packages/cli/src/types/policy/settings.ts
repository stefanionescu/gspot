import type { z } from 'zod';
import type { FileCopy } from '#cli/types/platform/root.ts';
import type { KeyPath } from '#cli/types/parsers/document.ts';
import type { Defined } from '#cli/types/platform/runtime.ts';
import type { namingLists } from '#cli/parsers/schema/naming.ts';
import type { SettingValueDeclaration } from '#cli/types/parsers/settings.ts';
import type { agentRulesValuesSchema } from '#cli/policy/schema/agent-rules.ts';
import type { ScopeEntry, FileDeclaration } from '#cli/types/repository/inventory.ts';
import type { limitTableSchema, namingCategorySchema } from '#cli/policy/schema/contracts.ts';
import type { Manifest, CheckDeclaration, SettingDeclaration } from '#cli/types/configurations.ts';
import type { scopeSchema, policySchema, policyTableValuesSchema } from '#cli/policy/schema/public.ts';
import type { SettingOptions, SettingNamespace, ActiveSettingNamespaces } from '#cli/types/policy/setting-values.ts';

export type RawArchitecture = NonNullable<RawPolicy['architecture']>;

export type ArchitectureElement = Omit<NonNullable<RawArchitecture['modules']>[number], 'may_import'> & {
    may_import: string[];
};

export type ScopeSelection = {
    scope: ScopeEntry;
    selected: Manifest[];
    surface: KnownSettings;
    view: ScopeView;
};

export type IgnoreEntry = NonNullable<RawPolicy['ignore']>[number];

export type PolicyFile = {
    policy: Policy;
    path: string;
    text: string;
    /** The wrong entries reading dropped; empty for a policy every command accepts. */
    errors: PolicyError[];
};

/** An authored policy value and the semantic error it caused. */
export type PolicyError = { path: KeyPath; message: string };

export type FormatSettings = Required<Defined<Omit<NonNullable<RawPolicy['format']>, 'overrides'>>>;

/** Values validated once for a selected scope and then consumed by checks and generators. */
export type ScopeSettings = {
    settings: Record<string, unknown>;
    values: ActiveSettingNamespaces;
    limits: z.output<typeof limitTableSchema>;
    test_files: Policy['test_files'];
};

export type ScopeView = {
    configurations: string[];
    test_files: Policy['test_files'];
    settings: Record<string, unknown>;
    format: FormatSettings;
    roles: Policy['architecture']['roles'];
    limit: (key: string, language?: string) => number | undefined;
    values: ActiveSettingNamespaces;
    options: <Name extends SettingNamespace>(name: Name) => SettingOptions<Name>;
    ignoresFor: (check: string) => (IgnoreEntry & { paths: string[] })[];
    rulesOff: (check: string) => string[];
    verbatim: (name: string) => Record<string, unknown> | undefined;
};

export type SettingEntry = {
    key: string;
    declaration: SettingDeclaration;
    value: unknown;
    reason?: string;
    source: string;
    scope?: string;
};

/** One layer of policy that a key is resolved through: the root table or one scope table. */
export type PolicyTable = { table: Partial<Policy>; name: string; path: string };

/** Where a resolved value stands after some layers were applied. */
export type SettingState = { value: unknown; source: string; reason: string | undefined };

export type KnownSettings = {
    declarations: Map<string, SettingDeclaration>;
    defaults: Map<string, SettingDefault>;
    errors: { key: string; message: string }[];
};

export type TomlTable = Record<string, unknown>;

/** A written key matched to its declaration and its declared language and category. */
export type DeclarationMatch = { declaration: SettingDeclaration; language?: string; category?: string };

export type ToolTable = Record<string, unknown> & NonNullable<NonNullable<RawPolicy['tools']>['prettier']>;

/** gspot.toml as the schema accepts it, before normalization. */
export type RawPolicy = z.infer<typeof policySchema>;

/** One [[scope]] entry as written. */
export type RawScope = z.infer<typeof scopeSchema>;

export type StructureSettings = Defined<Required<NonNullable<RawPolicy['structure']>>>;

export type LimitTable = Record<string, number | unknown[]>;

/** Root-relative path and selected configurations of an authored policy scope. */
export type PolicyScope = { configurations: string[]; removed_configurations: string[] };

export type Policy = {
    /** Validated source table before execution defaults and normalization. */
    authored: RawPolicy | RawScope;
    level: NonNullable<RawPolicy['level']>;
    exclude: NonNullable<RawPolicy['exclude']>;
    configurations: string[];
    reasons: Record<string, string>;
    configurationSettings?: Record<string, Record<string, unknown>>;
    scope: Record<string, PolicyScope>;
    removed_configurations: string[];
    limits: Limits;
    naming: NamingSettings;
    architecture: ArchitectureSettings;
    structure: StructureSettings;
    format: Defined<NonNullable<RawPolicy['format']>>;
    words: NonNullable<RawPolicy['words']>;
    tools: Record<string, ToolTable>;
    test_files: string[];
    tool_timeout_seconds?: NonNullable<RawPolicy['tool_timeout_seconds']>;
    ignore: IgnoreEntry[];
    declarations: FileDeclaration[];
    check: Record<string, RepositoryDefinition>;
    hooks?: Defined<Required<NonNullable<RawPolicy['hooks']>>>;
    ci?: NonNullable<z.output<typeof policyTableValuesSchema>['ci']>;
    agent_rules: z.output<typeof agentRulesValuesSchema>;
    runner?: NonNullable<RawPolicy['runner']>;
    scopeTables: Record<string, Partial<Policy> & Pick<Policy, 'authored'>>;
};

export type AuthoredSetting = Pick<SettingEntry, 'value' | 'reason'>;

export type Limits = {
    root: LimitTable;
    groups: Record<string, LimitTable>;
};

export type NamingTable = z.output<typeof namingCategorySchema>;

export type NamingLanguageTable = NamingTable & {
    categories: Record<string, NamingTable>;
};

export type NamingSettings = Defined<z.infer<typeof namingLists>> & {
    languages: Record<string, NamingLanguageTable>;
};

export type RepositoryDefinition = CheckDeclaration & {
    command: string[];
    files: NonNullable<CheckDeclaration['files']>;
};

/** The [limits] table as written. */
export type RawLimits = NonNullable<RawPolicy['limits']>;

/** The [naming] table as written. */
export type RawNaming = NonNullable<RawPolicy['naming']>;

export type ArchitectureSettings = Omit<Defined<Required<RawArchitecture>>, 'modules'> & {
    modules: ArchitectureElement[];
};

/** An explicit module contract and the scope whose files and test patterns it owns. */
export type ArchitectureDeclaration = { selection: ScopeSelection; architecture: ArchitectureSettings };

/** Root or scoped values and their source-document location. */
export type PolicyLocation = { table: Partial<Policy> & Pick<Policy, 'authored'>; scope?: string; path: KeyPath };

/** A setting default and the configuration responsible for it. */
export type SettingDefault = { value: unknown; configuration: string };

/** An invalid rule exclusion at its position in the authored list. */
export type RuleExclusionError = { index: number; message: string };

/** Authored reason tables retain their own root or scoped value presence. */
export type AuthoredReasons = {
    reasons?: Record<string, string> | undefined;
    scope?: Record<string, { reasons?: Record<string, string> | undefined }> | undefined;
};

/** Native authored values and their immutable serialization before a mutation. */
export type PolicyEdit = { text: string; table: TomlTable; values: string };

/** The native edit and the private file identity captured before publication. */
export type CapturedPolicyEdit = PolicyEdit & { original: FileCopy };

export type PreparedPolicy = Proposal & { original: FileCopy };

export type Proposal = { text: string; policy: Policy; changed: boolean };

export type Mutation = (raw: TomlTable) => void;

/** Dotted mutation key split into its containing tables and leaf field. */
export type PolicyKey = { path: string[]; name: string };

/** Transform or observe one declared native path without changing its role. */
export type PolicyPathCallback = (
    path: string,
    keys: KeyPath,
    role: NonNullable<SettingValueDeclaration['path_role']>,
) => string;

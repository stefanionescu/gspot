import type { z } from 'zod';
import type { RuleSettings } from '#cli/types/rules.ts';
import type { Defined } from '#cli/types/platform/runtime.ts';
import type { KeyPath } from '#cli/types/platform/document.ts';
import type { namingLists } from '#cli/parsers/schema/naming.ts';
import type { namingCategorySchema } from '#cli/policy/schema/fields.ts';
import type { scopeSchema, policySchema } from '#cli/policy/schema/policy.ts';
import type { Manifest, CheckSpec, SettingSpec } from '#cli/types/configurations.ts';
import type { ScopeEntry, FileDeclaration } from '#cli/types/repository/inventory.ts';
import type { environmentSettingsSchema } from '#cli/policy/schema/configurations.ts';

export type RawArchitecture = NonNullable<RawPolicy['architecture']>;

export type ArchitectureElement = NonNullable<RawArchitecture['modules']>[number];

export type ScopeSelection = {
    scope: ScopeEntry;
    selected: Manifest[];
    surface: KnownSettings;
    view: ScopeView;
};

export type IgnoreEntry = NonNullable<RawPolicy['ignore']>[number];

export type Proposal = { text: string; policy: Policy; changed: boolean };

export type PolicyFile = {
    policy: Policy;
    path: string;
    text: string;
    /** The wrong entries reading dropped; empty for a policy every command accepts. */
    problems: PolicyProblem[];
};

/** An authored policy value and the semantic problem it caused. */
export type PolicyProblem = { path: KeyPath; message: string };

export type FormatSettings = Required<Defined<Omit<NonNullable<RawPolicy['format']>, 'overrides'>>>;

/** Environment declarations after defaults and authored reason wrappers are resolved. */
export type EnvironmentSettings = {
    [Key in keyof z.infer<typeof environmentSettingsSchema>]-?: Exclude<
        z.infer<typeof environmentSettingsSchema>[Key],
        Reasoned<string[]> | undefined
    >;
};

export type ScopeView = {
    configurations: string[];
    settings: Record<string, unknown>;
    format: FormatSettings;
    limit: (key: string, language?: string) => number | undefined;
    options: (name: string) => Record<string, unknown>;
    ignoresFor: (check: string) => IgnoreEntry[];
    rulesOff: (check: string) => string[];
    verbatim: (name: string) => Record<string, unknown> | undefined;
};

export type ResolvedSetting = {
    key: string;
    spec: SettingSpec;
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
    specs: Map<string, SettingSpec>;
    defaults: Map<string, SettingDefault>;
    problems: { key: string; message: string }[];
};

export type TomlTable = Record<string, unknown>;

/** A written key matched to its specification and its declared language and category. */
export type SpecMatch = { spec: SettingSpec; language?: string; category?: string };

export type ToolTable = Record<string, unknown> & {
    verbatim?: Record<string, unknown> & { reason?: string };
};

/** gspot.toml as the schema accepts it, before normalization. */
export type RawPolicy = z.infer<typeof policySchema>;

/** One [[scope]] entry as written. */
export type RawScope = z.infer<typeof scopeSchema>;

export type StructureSettings = NonNullable<RawPolicy['structure']>;

export type LimitTable = Record<string, Reasoned<number | unknown[]>>;

/** Root-relative path and selected configurations of an authored policy scope. */
export type PolicyScope = { path: string; configurations: string[] };

export type Policy = {
    level: RawPolicy['level'];
    require_reasons: RawPolicy['require_reasons'];
    exclude: RawPolicy['exclude'];
    configurations: string[];
    configurationSettings?: Record<string, Record<string, unknown>>;
    scopes: PolicyScope[];
    limits: Limits;
    naming: NamingSettings;
    architecture: ArchitectureSettings;
    structure: StructureSettings;
    format: Defined<NonNullable<RawPolicy['format']>>;
    prose: NonNullable<RawPolicy['prose']>;
    tools: Record<string, ToolTable>;
    tests: string[];
    tool_timeout_seconds?: NonNullable<RawPolicy['tool_timeout_seconds']>;
    ignores: IgnoreEntry[];
    declarations: FileDeclaration[];
    checks: RepositoryDefinition[];
    hooks?: Defined<NonNullable<RawPolicy['hooks']>>;
    ci?: NonNullable<RawPolicy['ci']>;
    agentRules: RuleSettings;
    run_with?: NonNullable<RawPolicy['run_with']>;
    scopeTables: Record<string, Partial<Policy>>;
};

export type Reasoned<T> = { value: T; reason?: string };

export type Limits = {
    root: LimitTable;
    groups: Record<string, LimitTable>;
};

export type NamingTable = {
    [Key in keyof z.infer<typeof namingCategorySchema>]: Reasoned<
        Exclude<z.infer<typeof namingCategorySchema>[Key], Required<Reasoned<unknown>> | undefined>
    >;
};

export type NamingLanguageTable = NamingTable & {
    categories: Record<string, NamingTable>;
};

export type NamingSettings = Defined<z.infer<typeof namingLists>> & {
    languages: Record<string, NamingLanguageTable>;
};

export type RepositoryDefinition = CheckSpec & { command: string[]; files: NonNullable<CheckSpec['files']> };

/** The [limits] table as written. */
export type RawLimits = NonNullable<RawPolicy['limits']>;

/** The [naming] table as written. */
export type RawNaming = NonNullable<RawPolicy['naming']>;

export type Mutation = (raw: TomlTable) => void;

export type ArchitectureAllow = Defined<NonNullable<RawArchitecture['imports_allowed']>[number]>;

export type ArchitectureSettings = Omit<Defined<Required<RawArchitecture>>, 'imports_allowed'> & {
    imports_allowed: ArchitectureAllow[];
};

/** An explicit module contract and the scope whose files and test patterns it owns. */
export type ArchitectureDeclaration = { selection: ScopeSelection; architecture: ArchitectureSettings };

/** Dotted mutation key split into its containing tables and leaf field. */
export type PolicyKey = { path: string[]; name: string };
/** Root or scoped values and their source-document location. */
export type PolicyLocation = { table: Partial<Policy>; scope?: string; path: KeyPath };

/** A setting default and the configuration responsible for it. */
export type SettingDefault = { value: unknown; configuration: string };

/** Validated direct or reasoned setting values retain the inner schema's type. */
export type ReasonedSchema<T extends z.ZodType> = z.ZodUnion<
    [T, z.ZodObject<{ value: T; reason: z.ZodString }, z.core.$strict>]
>;

/** A reasoned collection of repository paths accepted by a configuration-specific policy. */
export type PathAllowance = NonNullable<NonNullable<RawPolicy['structure']>['lone_files_allowed']>[number];
/** Named entries accepted by a configuration-specific policy, with their authored reason. */
export type NameAllowance = { names?: string[]; reason?: string };

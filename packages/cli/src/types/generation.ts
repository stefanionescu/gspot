import type { z } from 'zod';

import type { PRINTED_RULE_TOOLS } from '#cli/config/generation/setup.ts';
import type { FROZEN_INSTALLS } from '#cli/config/repository/projects.ts';
import type {
    carryoverRowSchema,
    generatedFilesSchema,
    initFileRowSchema,
    initPlanSchema,
    leftOutSettingSchema,
    prettierSettingsSchema,
    ruffOptionsSchema,
} from '#cli/schemas/generation.ts';
import type { ConfigOwner, IgnoreSection, SourcedConfig } from '#cli/types/configurations/shared.ts';
import type { SessionOptions } from '#cli/types/engine/plan.ts';
import type { ConfigTargets } from '#cli/types/engine/tool-runs.ts';
import type { Config, Configuration, Tool } from '#cli/types/manifests.ts';
import type {
    ConfigurationEvidence,
    ConflictingConfig,
    LintCommand,
    ManagedKeys,
    PackageManagerPin,
    ProposedConfigurations,
    Repository,
    RepositorySetup,
    ScopeFolder,
    StartRunner,
    TrackedFile,
    WritePlan,
} from '#cli/types/repository.ts';
import type { AvailableSettings, Level, Scope, Settings, TomlTable } from '#cli/types/settings.ts';
import type { FileContents, TextRange } from '#cli/types/system.ts';
import type { ExecutableSearch, GeneratedFile, Generation, Session } from '#cli/types/tools.ts';

export type OwnedConfig = { config: Config; owner: ConfigOwner };

export type PlannedPointerField = {
    scope: Scope;
    configuration: Configuration;
    tool: Tool;
    consumed: boolean;
    paths: ReadonlySet<string>;
    configs: ConfigTargets;
    scopePaths: string[];
};

export type OwnedSourceFile = OwnedConfig & { config: SourcedConfig };

export type BuiltConfig = OwnedSourceFile & {
    file: GeneratedFile;
    companions: GeneratedFile[];
};

export type ConfigBuildState = {
    ignoreSections: IgnoreSection[];
    targets: Map<string, Map<string, string>>;
    files: Map<string, GeneratedFile>;
    failures: Map<string, Map<string, Error>>;
};

export type UsedNames = { tools: Set<string>; checks: Set<string> };

export type ApplyReport = z.infer<typeof generatedFilesSchema>;

/**
The writes that bring the generated files of a repository up to date, one list per kind of plan.
*/
export type GeneratedWritePlans = {
    replacements: WritePlan[];
    managedKeys: WritePlan[];
    blocks: WritePlan[];
    removals: WritePlan[];
};

export type ActionPin = { name: string; sha: string; version: string };

export type Pipeline = {
    version: string;
    node: string;
    packageManager?: PackageManagerPin | undefined;
    setupCommand?: NonNullable<Settings['ci']>['setup_command'];
    projectInstall: string[];
    operatingSystems: NonNullable<NonNullable<Settings['ci']>['operating_systems']>;
    linuxRunner: NonNullable<Settings['ci']>['linux_runner'];
    testChecks: string[];
};

export type FrozenLockfile = keyof typeof FROZEN_INSTALLS;

export type RuleFile = {
    path: string;
    target: string;
    content: string;
    scopes: string[];
};

export type AgentsBlockContent = {
    files: RuleFile[];
    startCommand: string;
    hasOwnTitle: boolean;
    hooksEnabled: boolean;
};

export type RuleSection = {
    start: number;
    end: number;
    depth: number;
    marker: TextRange | undefined;
};

export type InitScan = {
    template?: Template | undefined;
    repository: Repository;
    repositorySetup: RepositorySetup;
    configurations: ProposedConfigurations;
    scopes: Array<Pick<Scope, 'path' | 'configurations'>>;
    everySelected: Configuration[];
    conflicts: ConflictingConfigs;
    pinPath?: string | undefined;
    lintCommands: LintCommand[];
    carryover: CarryoverRow[];
    crlfPaths: string[];
};

export type InitPlan = z.infer<typeof initPlanSchema>;

export type CarryoverRow = z.infer<typeof carryoverRowSchema>;

export type RuleRead = {
    definition: (typeof PRINTED_RULE_TOOLS)[number];
    path: string;
    others: string[];
    text: string;
    sample: string;
    user: RuleTable | undefined;
};

export type Carryover = { settings: TomlTable; rows: CarryoverRow[] };

export type CarryoverSection = { tools: TomlTable; ignore: readonly TomlTable[]; rows: readonly CarryoverRow[] };

export type ToolCarryoverInput = {
    setting: 'markdownlint' | 'commitlint';
    check: string;
    tool: string;
    path: string;
    compared: ComparedRules;
    options: Map<string, unknown>;
    dropped: readonly string[];
};

export type MarkdownlintConfig = { path: string; rules: Record<string, unknown>; dropped: readonly string[] };

export type CarryoverInput = {
    repository: Repository;
    conflictingConfigs: ConflictingConfig[];
    session: Session;
    tools: ReadonlySet<string>;
    prettierScripts: PrettierScripts;
    trackedPaths: readonly string[];
    templateIgnore: readonly TomlTable[];
};

export type PlannedSettings = { carryover: Carryover; settingsText: string; settings: Settings; session: Session };

export type RuleState = { on: boolean; options: unknown[] };

export type RuleTable = Map<string, RuleState>;

export type RuleComparison = {
    check: string;
    user: RuleTable;
    lookup: (rule: string) => RuleState | undefined;
};

export type ComparedRules = {
    covered: number;
    options: Map<string, unknown[]>;
    weakened: string[];
    added: string[];
};

export type RuffRuleInput = { path: string; options: RuffOptions; shipped: string[] };

export type RuffRules = {
    rules: string[];
    ignores: Array<{ rule: string; file: string | undefined }>;
    row: CarryoverRow;
};

export type PrintedRules = {
    root: string;
    tool: string;
    search: ExecutableSearch;
    commandArguments: string[];
    hasSeverity: boolean;
};

export type ConflictSearch = { tools: Set<string>; managedKeys: ManagedKeys[]; prettierScripts: PrettierScripts };

export type ConflictingConfigs = {
    changed: InitFileRow[];
    reviewed: Map<string, FileContents | undefined>;
    deleted: Array<{ path: string; tool: string; unreadablePrettier: boolean; dropsLineEndings: boolean }>;
    kept: InitFileRow[];
};

export type SettingsDraft = {
    template?: Template | undefined;
    base: string;
    level?: Level | undefined;
    configurations: string[];
    scopes: ScopeFolder[];
    prettierScripts: PrettierScripts;
    trackedPaths: readonly string[];
    carried?: TomlTable | undefined;
};

export type InitPlanning = {
    detection: DetectionSummary;
    session: Session;
    generated: Generation;
    plan: InitPlan;
    settingsText: string;
    reviewed: Map<string, FileContents | undefined>;
    replaced: string[];
    pinPath: string | undefined;
};

export type DetectionSummary = {
    files: TrackedFile[];
    detected: ConfigurationEvidence[];
    scopes: ScopeFolder[];
    repositorySetup: RepositorySetup;
    owned: string[];
    unowned: string[];
};

export type InitFileRow = z.infer<typeof initFileRowSchema>;

export type InitOptions = {
    template?: Template | undefined;
    level?: Level | undefined;
    configurations?: string[] | undefined;
};

export type PrettierOptions = z.infer<typeof prettierSettingsSchema>;

export type PrettierStyle = Omit<PrettierOptions, 'dropped'>;

export type PrettierScripts = ReadonlyMap<string, PrettierOptions>;

export type FormatSearch = { root: string; scopePath: string; scripts: PrettierScripts };

export type RuffOptions = z.infer<typeof ruffOptionsSchema>;

export type WrittenTable = { scopePath: string; table: TomlTable; availableSettings: AvailableSettings };

// `writtenTable` is the table that a value sits in, among the `tables` of the settings file.
export type WrittenTables = { writtenTable: WrittenTable; tables: WrittenTable[]; settings: Settings };

export type EditorconfigSection = { files: string; fields: Record<string, string> };

export type Template = {
    file: string;
    text: string;
    table: TomlTable;
    configurations: string[];
    removed: string[];
    leftOut: LeftOutSetting[];
};

export type LeftOutSetting = z.infer<typeof leftOutSettingSchema>;

export type SettingsPlan = {
    root: string;
    draft: SettingsDraft;
    repository: Repository;
    conflictingConfigs: ConflictingConfig[];
    sessionOptions: Pick<SessionOptions, 'cache' | 'listing'>;
    startRunner: StartRunner | undefined;
};

import type { z } from 'zod';
import type { SessionOptions } from '#cli/types/engine/plan.ts';
import type { Tool, Configuration } from '#cli/types/manifests.ts';
import type { ConfigTargets } from '#cli/types/engine/tool-runs.ts';
import type { TextRange, FileContents } from '#cli/types/system.ts';
import type { OwnedConfig } from '#cli/types/configurations/language.ts';
import type { PRINTED_RULE_TOOLS } from '#cli/config/repository/setup.ts';
import type { FROZEN_INSTALLS } from '#cli/config/repository/javascript.ts';
import type { SourcedConfig, IgnoreSection } from '#cli/types/configurations/general.ts';
import type { Session, Generation, GeneratedFile, ExecutableSearch } from '#cli/types/tools.ts';
import type { Level, Scope, Settings, TomlTable, AvailableSettings } from '#cli/types/settings.ts';
import type { ruffOptionsSchema, generatedFilesSchema, prettierSettingsSchema } from '#cli/schemas/generation.ts';

import type {
    Repository,
    ManagedKeys,
    LintCommand,
    ScopeFolder,
    TrackedFile,
    RepositorySetup,
    PackageManagerPin,
    ConflictingConfig,
    ConfigurationOrigin,
    ConfigurationEvidence,
    ProposedConfigurations,
} from '#cli/types/repository.ts';

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

export type ActionPin = { name: string; sha: string; version: string };

export type Pipeline = {
    version: string;
    packageManager?: PackageManagerPin | undefined;
    setupCommand?: NonNullable<Settings['ci']>['setup_command'];
    projectInstall: string[];
    operatingSystems: NonNullable<Settings['ci']>['operating_systems'];
    linuxRunner: NonNullable<Settings['ci']>['linux_runner'];
    testChecks: string[];
};

export type FrozenLockfile = keyof typeof FROZEN_INSTALLS;

export type RuleFile = {
    path: string;
    target: string;
    content: string;
    scopes: string[];
    group: Configuration['group'];
};

export type AgentsBlockContent = {
    files: RuleFile[];
    managedKeys: Array<{ path: string; keys: string[] }>;
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

export type InitPlan = {
    from?: { file: string; leftOutSettings: LeftOutSetting[] };
    level: Level;
    configurations: Array<{
        configuration: string;
        origin: ConfigurationOrigin;
        scopes: string[];
        checks: number;
        checksOff: number;
    }>;
    write: InitFileRow[];
    deleted: InitFileRow[];
    keep: InitFileRow[];
    change: InitFileRow[];
    lintFolders: InitFileRow[];
    lintCommands: LintCommand[];
    carryover: CarryoverRow[];
};

export type CarryoverRow = {
    path: string;
    tool: string;
    covered: number;
    carried: readonly string[];
    differing: readonly string[];
    reasons: readonly string[];
    plugins: readonly string[];
    commandChecks: readonly string[];
    dropped: readonly string[];
};

export type RuleRead = {
    definition: (typeof PRINTED_RULE_TOOLS)[number];
    path: string;
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
    configurations: Configuration[];
    tools: ReadonlySet<string>;
    level: Level;
    prettierScripts: PrettierScripts;
    trackedPaths: readonly string[];
    templateIgnore: readonly TomlTable[];
};

export type SettingsPlan = {
    root: string;
    draft: SettingsDraft;
    repository: Repository;
    configurationsByName: ReadonlyMap<string, Configuration>;
    conflictingConfigs: ConflictingConfig[];
    sessionOptions: Pick<SessionOptions, 'cache' | 'listing'>;
};

export type PlannedSettings = { carryover: Carryover; settingsText: string; settings: Settings; planned: Session };

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
    configurationsByName: ReadonlyMap<string, Configuration>;
};

export type InitFileRow = { path: string; note: string };

export type InitOptions = {
    template?: Template | undefined;
    cwd: string;
    level?: Level | undefined;
    configurations?: string[] | undefined;
};

export type PrettierOptions = z.infer<typeof prettierSettingsSchema>;

export type PrettierStyle = Omit<PrettierOptions, 'dropped'>;

export type PrettierScripts = ReadonlyMap<string, PrettierOptions>;

export type FormatSearch = { root: string; scopePath: string; scripts: PrettierScripts };

export type RuffOptions = z.infer<typeof ruffOptionsSchema>;

export type WrittenTable = { scope: string; table: TomlTable; availableSettings: AvailableSettings };

export type EditorconfigSection = { files: string; fields: Record<string, string> };

export type Template = {
    file: string;
    text: string;
    table: TomlTable;
    configurations: string[];
    removed: string[];
    leftOut: LeftOutSetting[];
};

export type LeftOutSetting = { key: string; note: string };

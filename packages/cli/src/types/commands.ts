import type { z } from 'zod';

import type { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { CHECK_INPUT_HOOKS } from '#cli/config/commands/reports.ts';
import type {
    checkExplanationSchema,
    checkIgnoreSchema,
    ciStateSchema,
    configurationExplanationSchema,
    configurationsListSchema,
    doctorReportSchema,
    doctorToolSchema,
    initReportSchema,
    installReportSchema,
    lintRuleExplanationSchema,
    pathExplanationSchema,
    pushReportSchema,
    scanCategorySchema,
    scanReportSchema,
    settingExplanationSchema,
    settingsEditReportSchema,
    settingsListSchema,
} from '#cli/schemas/commands.ts';
import type { RunSelection, SessionOptions, StageFilter } from '#cli/types/engine/plan.ts';
import type { RunReport } from '#cli/types/engine/run.ts';
import type { CarryoverRow, InitPlanning } from '#cli/types/generation.ts';
import type { Setting } from '#cli/types/manifests.ts';
import type { PushedRevisions, RepositoryListing } from '#cli/types/repository.ts';
import type { IgnoreRecord, InheritedSetting, Level, Settings, SettingsFile, TomlTable } from '#cli/types/settings.ts';
import type { CanceledCommandJson, CommandResult, RunCache } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

export type CommandLocation = { readonly root: string; readonly cwd: string };

export type ArgumentDefinition = { term: string; choices?: readonly string[]; defaultValue?: string };

export type OptionDefinition = {
    flags: string;
    choices?: readonly string[];
    required?: boolean;
    hidden?: boolean;
    list?: string;
    repeats?: true;
};

export type CommandDefinition<
    Arguments extends readonly unknown[] = readonly unknown[],
    Flags = object,
    Input = { arguments: Arguments; flags: Flags; cwd: string },
> = {
    name: keyof typeof COMMAND_HELP;
    arguments?: readonly ArgumentDefinition[];
    options?: readonly OptionDefinition[];
    parse?(raw: { arguments: Arguments; flags: Flags; cwd: string }): Input;
    run(input: Input & CommandLocation): Promise<CommandResult<object>>;
};

export type AnyCommandDefinition = CommandDefinition<readonly unknown[], object, object>;

export type ScopeFlags = { scope?: string | undefined };

export type ReasonFlags = ScopeFlags & { reason?: string | undefined };

export type IgnoreFlags = { reason: string; rule?: string | undefined; paths?: string[] | undefined };

export type InitFlags = { from?: string; configurations?: string[]; level?: Level };

export type IgnoreOptions = CommandLocation & {
    check?: string | undefined;
    paths?: string[] | undefined;
    rule?: string | undefined;
    reason: string;
};

export type InstallCommandJson = z.infer<typeof installReportSchema>;

export type SetOptions = CommandLocation & {
    key: string;
    values: string[];
    reason?: string | undefined;
    scopePath?: string | undefined;
};

export type ParsedSettingValue = { type: 'list'; value: unknown[] } | { type: 'scalar'; value: unknown };

export type SettingReasonContext = {
    options: SetOptions;
    setting: Setting;
    change: ParsedSettingValue;
    joined: unknown;
    previous: InheritedSetting | undefined;
    shippedDefault: unknown;
};

export type IgnoreRemoval = {
    kept: unknown[];
    deleted: number;
    changedIgnores: number;
    removedPaths: number;
    everywhere: IgnoreRecord[];
};

export type IgnoreTarget = { unmatched: string; removed: string };

export type UnsetOptions = CommandLocation & { key: string; keys: string[]; scopePath?: string | undefined };

export type InitJson = z.infer<typeof initReportSchema>;

export type ConfigurationsOptions = CommandLocation & {
    configurations: string[];
    scopePath?: string | undefined;
};

export type RemoveOptions = ConfigurationsOptions & { reason: string };

export type ConfigurationChange = {
    action: string;
    changed: string[];
    where: string;
    unchanged: string[];
    state: string;
};

export type EditContext = {
    root: string;
    file: SettingsFile;
    settings: Settings;
    cache: RunCache;
    listing: RepositoryListing;
};

export type SettingsEditContext = EditContext & { session: Session; scopePath: string; scopeTable: TomlTable };

export type SettingsEditOptions = {
    summary: string;
    unchangedSummary?: string;
    notes?: string[];
};

export type SettingsEditReport = z.infer<typeof settingsEditReportSchema>;

export type PushReport = z.infer<typeof pushReportSchema>;

type PushInput = { stdin: string; remote?: string };

export type RevisionCheckResult = CommandResult<RunReport> | { skipped: PushedRevisions['skipped'][number]['reason'] };

export type CheckOptions = {
    hook?: CheckHook | undefined;
    cwd: string;
    only?: string[] | undefined;
    skip?: string[] | undefined;
    paths: string[];
    staged: boolean;
    push?: PushInput | undefined;
    base?: string | undefined;
    fix: boolean;
    stage?: StageFilter | undefined;
    messageFile?: string | undefined;
    messageArgument?: string | undefined;
    verbose: boolean;
    session?: Pick<SessionOptions, 'toolCache' | 'settings' | 'listing'>;
};

export type RevisionSource = {
    session: Pick<SessionOptions, 'toolsRoot' | 'untracked' | 'unreadablePaths'>;
    selection: RunSelection & { content: 'index' | 'commit' };
    started?: Date;
    dependencyNote?: string;
    missingToolsNote?: string;
};

type CheckHook = (typeof CHECK_INPUT_HOOKS)[number];

export type CheckFlags = {
    only?: string[];
    skip?: string[];
    staged?: boolean;
    base?: string;
    fix?: boolean;
    hook?: CheckHook;
    verbose?: boolean;
};

export type CheckCommandJson = RunReport | PushReport | CanceledCommandJson;

export type ConfigurationsListJson = z.infer<typeof configurationsListSchema>;

export type SettingsListJson = z.infer<typeof settingsListSchema>;

export type DoctorTool = z.infer<typeof doctorToolSchema>;

export type DoctorReport = z.infer<typeof doctorReportSchema>;

export type CiState = z.infer<typeof ciStateSchema>;

export type Explanation = { subject: string; text: string } & (
    | { kind: 'check'; facts: CheckExplanation }
    | { kind: 'lint-rule'; facts: LintRuleExplanation }
    | { kind: 'configuration'; facts: ConfigurationExplanation }
    | { kind: 'setting'; facts: SettingExplanation }
    | { kind: 'path'; facts: PathExplanation }
);

export type CheckExplanation = z.infer<typeof checkExplanationSchema>;

export type LintRuleExplanation = z.infer<typeof lintRuleExplanationSchema>;

type SettingExplanation = z.infer<typeof settingExplanationSchema>;

export type ExplainedSetting = { setting: Setting; text: string; scopes: SettingExplanation['scopes'] };

export type CheckIgnore = z.infer<typeof checkIgnoreSchema>;

export type PathExplanation = z.infer<typeof pathExplanationSchema>;

export type SettingScope = {
    scopePath: string;
    shipped: unknown;
    inherited: InheritedSetting | undefined;
    readBy: string[];
};

export type ConfigurationExplanation = z.infer<typeof configurationExplanationSchema>;

export type ScanCategory = z.infer<typeof scanCategorySchema>;

export type ScanReport = z.infer<typeof scanReportSchema>;

export type ScanInput = {
    planning: InitPlanning;
    session: Session;
    report: RunReport;
    toolBytes: number;
    ruleRows: CarryoverRow[];
    leftOut: string[];
};

export type ScanSection = { title: string; rows: string[] };

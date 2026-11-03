import type { Session } from '#cli/types/tools.ts';
import type { Setting } from '#cli/types/manifests.ts';
import type { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { RepositoryListing } from '#cli/types/repository.ts';
import type { RunCache, CommandResult } from '#cli/types/system.ts';
import type { InitPlan, ApplyReport } from '#cli/types/generation.ts';
import type { Level, Settings, TomlTable, SettingsEdit, InheritedSetting } from '#cli/types/settings.ts';

export type CommandLocation = { readonly root: string; readonly cwd: string };

export type CommandArgument = { term: string; choices?: readonly string[]; defaultValue?: string };

export type CommandOption = {
    flags: string;
    choices?: readonly string[];
    required?: boolean;
    hidden?: boolean;
    parse?: (value: string, previous: string[] | undefined) => unknown;
};

export type CommandDefinition<Arguments extends readonly unknown[] = readonly unknown[], Flags = object> = {
    name: keyof typeof COMMAND_HELP;
    arguments?: readonly CommandArgument[];
    options?: readonly CommandOption[];
    run(args: Arguments, flags: Flags, location: CommandLocation): Promise<CommandResult<object>>;
};

export type CommandHelp = {
    summary: string;
    group: string;
    description: string;
    arguments: Readonly<Record<string, string>>;
    options: Readonly<Record<string, string>>;
    exitCodes: ReadonlyArray<readonly [string, string]>;
    example: string;
};

export type ScopeFlags = { scope?: string | undefined };

export type ReasonFlags = ScopeFlags & { reason?: string | undefined };

export type IgnoreFlags = { reason: string; rule?: string | undefined; paths?: string[] | undefined };

export type InitFlags = { from?: string; configurations?: string[] | false; level?: Level };

export type IgnoreOptions = {
    root: string;
    cwd: string;
    check?: string | undefined;
    paths?: string[] | undefined;
    rule?: string | undefined;
    reason: string;
};

export type InstallCommandJson = {
    summary: string;
    installed: string[];
    steps: ReadonlyArray<readonly string[]>;
    notes: string[];
    missing: string[];
};

export type SetOptions = {
    root: string;
    cwd: string;
    key: string;
    values: string[];
    reason?: string | undefined;
    scope?: string | undefined;
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
    everywhere: number;
};

export type IgnoreTarget = { unmatched: string; removed: string };

export type UnsetOptions = { root: string; cwd: string; key: string; keys: string[]; scope?: string | undefined };

export type InitJson = { root: string; plan: InitPlan; settingsText: string } & ApplyReport;

export type ConfigurationsOptions = { root: string; cwd: string; configurations: string[]; scope?: string | undefined };

export type ConfigurationChange = {
    action: string;
    changed: string[];
    where: string;
    unchanged: string[];
    state: string;
};

export type IgnoreEditContext = {
    root: string;
    edit: SettingsEdit;
    settings: Settings;
    cache: RunCache;
    listing: RepositoryListing;
};

export type SettingsEditContext = IgnoreEditContext & { session: Session; scope: string; scopeTable: TomlTable };

export type SettingsEditOptions = {
    edit: SettingsEdit;
    summary: string;
    unchangedSummary?: string;
    notes?: string[];
    cache?: RunCache | undefined;
    listing?: RepositoryListing | undefined;
};

export type CommandCompletion = (result: CommandResult<object>) => void;

import type { z } from 'zod';

import type { COMMAND_HELP } from '#cli/config/commands/help.ts';
import type { initReportSchema, installReportSchema, settingsEditReportSchema } from '#cli/schemas/commands.ts';
import type { Setting } from '#cli/types/manifests.ts';
import type { RepositoryListing } from '#cli/types/repository.ts';
import type { IgnoreRecord, InheritedSetting, Level, Settings, SettingsEdit, TomlTable } from '#cli/types/settings.ts';
import type { CommandResult, RunCache } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

export type CommandLocation = { readonly root: string; readonly cwd: string };

export type CommandArgument = { term: string; choices?: readonly string[]; defaultValue?: string };

export type CommandOption = {
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
    arguments?: readonly CommandArgument[];
    options?: readonly CommandOption[];
    parse?(raw: { arguments: Arguments; flags: Flags; cwd: string }): Input;
    run(input: Input & CommandLocation): Promise<CommandResult<object>>;
};

export type AnyCommandDefinition = CommandDefinition<readonly unknown[], object, object>;

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

export type IgnoreEditContext = {
    root: string;
    edit: SettingsEdit;
    settings: Settings;
    cache: RunCache;
    listing: RepositoryListing;
};

export type SettingsEditContext = IgnoreEditContext & { session: Session; scopePath: string; scopeTable: TomlTable };

export type SettingsEditOptions = {
    summary: string;
    unchangedSummary?: string;
    notes?: string[];
};

export type SettingsEditReport = z.infer<typeof settingsEditReportSchema>;

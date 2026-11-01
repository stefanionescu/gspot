import type { RunCache } from '#cli/types/system.ts';
import type { STAGE_FILTERS } from '#cli/config/engine.ts';
import type { Tool, Check } from '#cli/types/manifests.ts';
import type { Host, Session, ConfiguredCheck } from '#cli/types/tools.ts';
import type { TrackedFile, RepositoryListing } from '#cli/types/repository.ts';
import type { Scope, Defined, Settings, TableValues } from '#cli/types/settings.ts';

export type SkipCause = 'level' | 'system' | 'replaced' | 'setting' | 'condition' | 'ignore';

export type Skip = { cause: SkipCause; note: string };

export type PlanOptions = {
    base?: string | undefined;
    commits?: string[] | undefined;
    range?: string[] | undefined;
    shallow?: boolean | undefined;
    stage: StageFilter | 'any';
    staged?: string[] | undefined;
    changed?: string[] | undefined;
    only?: string[] | undefined;
    paths?: string[] | undefined;
    messageFile?: string | undefined;
};

export type PlannedScope = {
    session: Session;
    scope: Scope;
    options: PlanOptions;
    host: Host;
    narrowedPaths: Set<string> | undefined;
    children: string[];
};

export type SettingsSkip = { cause: 'level' | 'ignore' | 'setting'; note: string };

export type PlannedCheck = ConfiguredCheck & {
    base?: string | undefined;
    commits?: string[] | undefined;
    range?: string[] | undefined;
    files: TrackedFile[];
    skip?: Skip | undefined;
    triggerPaths: string[];
    messageFile?: string | undefined;
};

export type StageFilter = (typeof STAGE_FILTERS)[number];

export type LicenseProject = {
    dependencyFile: string;
    scope: Scope;
    settings: ConfigurationTables['licenses'];
    skip: SettingsSkip | undefined;
};

export type SettingReader = { check: string; enabled: boolean; note?: string };

export type PrettierPlugin = {
    name: string;
    module: string;
    overrides: { files: string; options: Record<string, unknown> }[];
};

export type CheckDescription = {
    toolName: string | undefined;
    tools: string[];
    programs: string[];
    systems: string[] | undefined;
    needs: NonNullable<Check['needs']>;
    minVersions: Record<string, string>;
    turnOff: { paths: string; rule: string | undefined };
    suppression: Tool['suppression'];
};

export type SessionOptions = {
    toolsRoot?: string;
    cache?: RunCache | undefined;
    listing?: RepositoryListing | undefined;
    settingsFile?: SettingsFile;
    resources?: DisposableStack;
    cancelSignal?: AbortSignal | undefined;
};

export type SettingsFile = {
    settings: Settings;
    text: string;
};

export type ConfigurationTables = Defined<
    Required<Omit<TableValues, 'format' | 'limits' | 'naming' | 'structure' | `tools.${string}`>>
>;

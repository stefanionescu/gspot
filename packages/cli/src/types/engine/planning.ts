import type { Session } from '#cli/types/session.ts';
import type { RunCache } from '#cli/types/system/system.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { SettingsEdit } from '#cli/types/settings/edits.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import type { STAGE_FILTERS } from '#cli/config/engine/planning.ts';
import type { ConfigurationTables } from '#cli/types/settings/tables.ts';
import type { Tool, Check, Configuration } from '#cli/types/manifests.ts';
import type { Settings, TomlTable } from '#cli/types/settings/settings.ts';
import type { RepositoryListing } from '#cli/types/repository/repository.ts';

export type SkipCause = 'level' | 'system' | 'replaced' | 'setting' | 'condition' | 'ignore';

export type Skip = { cause: SkipCause; note: string };

export type Host = { platform: string; arch: string };

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

export type ConfiguredCheck = {
    scope: Scope;
    check: Check;
    configuration?: Configuration | undefined;
    tool?: Tool | undefined;
};

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

export type ConfigurationsOptions = { root: string; cwd: string; configurations: string[]; scope?: string | undefined };

export type ConfigurationChange = {
    action: string;
    changed: string[];
    where: string;
    unchanged: string[];
    state: string;
};

export type SettingsEditContext = {
    root: string;
    edit: SettingsEdit;
    settings: Settings;
    cache: RunCache;
    session: Session;
    listing: RepositoryListing;
    scope: string;
    scopeTable: TomlTable;
};

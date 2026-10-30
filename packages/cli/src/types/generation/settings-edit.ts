import type { Session } from '#cli/types/session.ts';
import type { RunCache } from '#cli/types/system/cache.ts';
import type { SettingsEdit } from '#cli/types/settings/edits.ts';
import type { RepositoryListing } from '#cli/types/repository/read.ts';
import type { Settings, TomlTable } from '#cli/types/settings/file.ts';

export type SettingsEditOptions = {
    edit: SettingsEdit;
    summary: string;
    notes?: string[];
    cache?: RunCache | undefined;
    listing?: RepositoryListing | undefined;
};

export type ConfigurationsOptions = { cwd: string; configurations: string[]; scope?: string | undefined };

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

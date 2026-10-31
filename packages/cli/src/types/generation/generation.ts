import type { TextRange } from '#cli/types/text.ts';
import type { RunCache } from '#cli/types/system/system.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { Settings } from '#cli/types/settings/settings.ts';
import type { SettingsEdit } from '#cli/types/settings/edits.ts';
import type { PackageManager } from '#cli/types/repository/javascript.ts';
import type { FROZEN_INSTALLS } from '#cli/config/generation/generation.ts';
import type { RepositoryListing } from '#cli/types/repository/repository.ts';

export type ActionPin = { name: string; sha: string; version: string };

export type Pipeline = {
    version: string;
    packageManager?: PackageManager | undefined;
    packageManagers: CiPackageManager[];
    setupCommand?: NonNullable<Settings['ci']>['setup_command'];
    projectInstall: string[];
    operatingSystems: NonNullable<Settings['ci']>['operating_systems'];
    linuxRunner: NonNullable<Settings['ci']>['linux_runner'];
    lockfiles: string[];
    hasSwift: boolean;
};

export type FrozenLockfile = keyof typeof FROZEN_INSTALLS;

export type CiPackageManager = (typeof FROZEN_INSTALLS)[FrozenLockfile][0];

export type RuleFile = {
    path: string;
    target: string;
    content: string;
    scopes: string[];
    group: Configuration['group'];
};

export type AgentsBlockContent = {
    files: RuleFile[];
    managedKeys: { path: string; keys: string[] }[];
    startCommand: string;
    hasOwnTitle: boolean;
};

export type RuleSection = {
    start: number;
    end: number;
    depth: number;
    marker: TextRange | undefined;
};

export type ShippedRule = {
    source: string;
    path: string;
    group: Configuration['group'];
};

export type SettingsEditOptions = {
    edit: SettingsEdit;
    summary: string;
    notes?: string[];
    cache?: RunCache | undefined;
    listing?: RepositoryListing | undefined;
};

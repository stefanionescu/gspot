import type { LimitFunction } from 'p-limit';
import type { RunCache } from '#cli/types/system/system.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { ConfiguredCheck } from '#cli/types/planning.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import type { ToolInspection } from '#cli/types/executables/inspection.ts';
import type { RepositoryListing } from '#cli/types/repository/repository.ts';
import type { Settings, SettingsFile } from '#cli/types/settings/settings.ts';
import { type StartRunner, type PackageManagerPin } from '#cli/types/repository/javascript.ts';

export type Session = {
    configuredChecks: ConfiguredCheck[];
    toolConfigurations: Configuration[];
    timeoutSeconds: number;
    root: string;
    inspections: Map<string, ToolInspection>;
    startRunner: StartRunner;
    toolsRoot: string;
    cache: RunCache;
    resources: DisposableStack;
    packageManager: PackageManagerPin | undefined;
    cancelSignal?: AbortSignal | undefined;
    settings: Settings;
    settingsText: string;
    configurationsByName: Map<string, Configuration>;
    repository: Repository;
    scopes: Scope[];
};

export type CheckSession = Session & { readMiseBinPaths: () => string[]; limitProcess: LimitFunction };

export type SessionOptions = {
    toolsRoot?: string;
    cache?: RunCache | undefined;
    listing?: RepositoryListing | undefined;
    settingsFile?: SettingsFile;
    resources?: DisposableStack;
    cancelSignal?: AbortSignal | undefined;
};

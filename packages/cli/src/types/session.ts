import type { ReadCache } from '#cli/types/system/files.ts';
import type { ConfiguredCheck } from '#cli/types/planning.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { ToolInspection } from '#cli/types/tools/inspection.ts';
import type { RepositoryListing } from '#cli/types/repository/read.ts';
import type { Settings, SettingsFile } from '#cli/types/settings/file.ts';
import { type StartRunner, type PackageManagerPin } from '#cli/types/repository/npm/package-manager.ts';

export type Session = {
    configuredChecks: ConfiguredCheck[];
    toolConfigurations: Configuration[];
    timeoutSeconds: number;
    root: string;
    inspections: Map<string, ToolInspection>;
    startRunner: StartRunner;
    toolsRoot: string;
    reads: ReadCache;
    resources: DisposableStack;
    packageManager: PackageManagerPin | undefined;
    cancelSignal?: AbortSignal | undefined;
    settings: Settings;
    settingsText: string;
    configurationsByName: Map<string, Configuration>;
    repository: Repository;
    scopes: Scope[];
};

export type CheckSession = Session & { readMiseBinPaths: () => string[] };

export type SessionOptions = {
    toolsRoot?: string;
    reads?: ReadCache;
    listing?: RepositoryListing;
    settingsFile?: SettingsFile;
    resources?: DisposableStack;
    cancelSignal?: AbortSignal | undefined;
};

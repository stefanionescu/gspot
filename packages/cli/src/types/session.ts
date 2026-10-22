import type { PlannedCheck } from '#cli/types/planning.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { SettingsFile } from '#cli/types/settings/file.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import type { ToolInspection } from '#cli/types/tools/inspection.ts';
import { type StartRunner, type PackageManagerPin } from '#cli/types/repository/package-manager.ts';

/** Settings, repository inventory, and configurations that planning and generation share. */
export type Session = {
    /** The checks that the settings turn on, across supported systems, planned once when the session opens. */
    configuredChecks: PlannedCheck[];
    neededToolConfigurations: Configuration[];
    timeoutSeconds: number;
    root: string;
    uvPath?: string;
    inspections: Map<string, ToolInspection>;
    miseBinPaths?: string[];
    startRunner: StartRunner;
    /** The working tree whose installed tools a copy of a revision runs. */
    installedRoot: string;
    reads: ReadCache;
    resources: DisposableStack;
    /** The package manager declaration, before an undeclared version needs a program query. */
    packageManager: PackageManagerPin | undefined;
    cancelSignal?: AbortSignal | undefined;
    settingsFile: SettingsFile;
    configurations: Map<string, Configuration>;
    repository: Repository;
    /** Each scope with its folder, configurations, known settings, and merged settings. */
    scopes: Scope[];
};

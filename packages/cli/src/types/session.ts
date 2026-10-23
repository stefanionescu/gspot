import type { PlannedCheck } from '#cli/types/planning.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { SettingsFile } from '#cli/types/settings/file.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { ToolInspection } from '#cli/types/tools/inspection.ts';
import { type StartRunner, type PackageManagerPin } from '#cli/types/repository/npm/package-manager.ts';

export type Session = {
    configuredChecks: PlannedCheck[];
    toolConfigurations: Configuration[];
    timeoutSeconds: number;
    root: string;
    uvPath?: string;
    inspections: Map<string, ToolInspection>;
    miseBinPaths?: string[];
    startRunner: StartRunner;
    installedRoot: string;
    reads: ReadCache;
    resources: DisposableStack;
    packageManager: PackageManagerPin | undefined;
    cancelSignal?: AbortSignal | undefined;
    settingsFile: SettingsFile;
    configurations: Map<string, Configuration>;
    repository: Repository;
    scopes: Scope[];
};

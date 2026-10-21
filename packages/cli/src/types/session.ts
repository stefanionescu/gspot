import type { PlannedCheck } from '#cli/types/planning.ts';
import type { ReadCache } from '#cli/types/system/files.ts';
import type { SettingsFile } from '#cli/types/settings/file.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import type { ToolInspection } from '#cli/types/tools/inspection.ts';
import { type StartRunner, type PackageManagerPin } from '#cli/types/repository/package-manager.ts';

/** Settings, repository inventory, and configurations shared by planning and generation. */
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
    /** The verified working tree with the installed tools, for a copy of a revision. */
    installedRoot: string;
    reads: ReadCache;
    resources: DisposableStack;
    /** The package manager declaration, before an undeclared version needs a program query. */
    packageManager: PackageManagerPin | undefined;
    cancelSignal?: AbortSignal | undefined;
    settingsFile: SettingsFile;
    configurations: Map<string, Configuration>;
    repository: Repository;
    /** The dependency files parsed from the source inventory of this session. */
    scopes: Scope[];
};

import type { Tool } from '#cli/types/configurations.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';

export type ActionPin = { name: string; sha: string; version: string };

export type Pipeline = {
    version: string;
    packageManager?: PackageManager | undefined;
    manualTools: Tool[];
    setupCommand?: NonNullable<Settings['ci']>['setup_command'];
    projectInstall: string[];
    operatingSystems: NonNullable<Settings['ci']>['operating_systems'];
    linuxRunner: NonNullable<Settings['ci']>['linux_runner'];
    lockfiles: string[];
    hasSwift: boolean;
    manualChecks: PlannedCheck[];
};

import type { Tool } from '#cli/types/configurations.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';

/** An action commit and the release that its comment names. */
export type ActionPin = { name: string; sha: string; version: string };

export type Pipeline = {
    version: string;
    packageManager?: PackageManager | undefined;
    manualTools: Tool[];
    setupCommand?: NonNullable<Settings['ci']>['setup_command'];
    projectInstall: string[];
    operatingSystems: NonNullable<Settings['ci']>['operating_systems'];
    /** Whether any scope uses the Swift configuration, which adds a macOS job. */
    hasSwift: boolean;
    /** The manual checks that the configurations declare, which the final job step runs by name. */
    manualChecks: PlannedCheck[];
};

/** The check step of a GitHub job and the optional condition for running that job. */
export type GithubCheck = { step: Record<string, unknown>; condition?: string };

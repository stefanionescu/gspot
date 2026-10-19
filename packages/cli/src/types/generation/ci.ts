import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { PackageManager } from '#cli/types/parsers/dependency-files.ts';

/** An action commit and the release that its comment names. */
export type ActionPin = { name: string; sha: string; version: string };

export type Pipeline = {
    version: string;
    packageManager?: PackageManager | undefined;
    manualTools: ToolDeclaration[];
    setupCommand?: NonNullable<Settings['ci']>['setup_command'];
    /** The shell lines that install the locked project dependencies when no setup command replaces them. */
    projectInstall: string[];
    operatingSystems: NonNullable<Settings['ci']>['operating_systems'];
    /** Whether a scope includes Swift. */
    hasSwift: boolean;
    /** The manual checks that the configurations declare, which the final job step runs by name. */
    manualChecks: PlannedCheck[];
};

/** The check step of a GitHub job and the optional condition for running that job. */
export type GithubCheck = { step: Record<string, unknown>; condition?: string };

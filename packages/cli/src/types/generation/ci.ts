import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { PackageManager } from '#cli/types/parsers/dependency-files.ts';

/** An action commit and the release that its comment names. */
export type ActionPin = { name: string; sha: string; version: string };

export type Pipeline = {
    version: string;
    npmClient?: PackageManager | undefined;
    manualTools: ToolDeclaration[];
    setupCommand?: NonNullable<Settings['ci']>['setup_command'];
    operatingSystems: NonNullable<Settings['ci']>['operating_systems'];
    /** Whether a selected scope includes Swift. */
    hasSwift: boolean;
    /** The manual checks the selected configurations declare, which the final job step runs by name. */
    manualChecks: PlannedCheck[];
};

/** The check step of a GitHub job and the optional condition for running that job. */
export type GithubCheck = { step: Record<string, unknown>; condition?: string };

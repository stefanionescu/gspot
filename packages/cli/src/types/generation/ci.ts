import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import type { NpmClient } from '#cli/types/parsers/dependency-files.ts';

/** An action commit and the release comment verified by pinact. */
export type ActionPin = { name: string; sha: string; version: string };

export type Pipeline = {
    version: string;
    npmClient?: NpmClient | undefined;
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

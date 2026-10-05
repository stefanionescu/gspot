import type { Policy } from '#cli/types/policy/settings.ts';

/** An action commit and the release comment verified by pinact. */
export type ActionPin = { name: string; sha: string; version: string };

export type Pipeline = {
    version: string;
    run?: NonNullable<Policy['ci']>['files'];
    platforms: string[];
    /** Whether a selected scope includes Swift. */
    hasSwift: boolean;
    isMise: boolean;
    /** The manual checks the selected configurations declare, which the manual job runs by name. */
    manualChecks: string[];
};

/** The check step of a GitHub job and the optional condition for running that job. */
export type GithubCheck = { step: Record<string, unknown>; condition?: string };

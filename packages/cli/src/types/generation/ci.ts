import type { Policy } from '#cli/types/policy/settings.ts';

/** An action commit and the release comment verified by pinact. */
export type ActionPin = { name: string; sha: string; version: string };

export type Pipeline = {
    version: string;
    run?: NonNullable<Policy['ci']>['files'];
    platforms: string[];
    /** The Swift scope path, or undefined when no scope selects swift. */
    swiftScope: string | undefined;
    isMise: boolean;
    /** The manual checks the selected configurations declare, which the manual job runs by name. */
    manualChecks: string[];
};

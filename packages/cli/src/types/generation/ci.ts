import type { Policy } from '#cli/types/policy/settings.ts';

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

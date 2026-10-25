import type { Configuration } from '#cli/types/configurations.ts';
import type { ScopeSettings, AvailableSettings } from '#cli/types/settings/inheritance.ts';

export type ScopeSelection = {
    scopeSettings: ScopeSettings;
    configurations: Configuration[];
    availableSettings: AvailableSettings;
};

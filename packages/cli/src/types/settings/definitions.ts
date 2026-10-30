import type { LEFT_OUT_NOTES } from '#cli/config/commands/init.ts';
import type { REASON_DESCRIPTIONS } from '#cli/config/settings/fields.ts';

export type ReasonedSettingDefinition = Required<Pick<SettingDefinition, 'description' | 'reason_when'>>;

export type ReasonRequirement = keyof typeof REASON_DESCRIPTIONS;

export type SettingDefinition = {
    template?: keyof typeof LEFT_OUT_NOTES;
    description?: string;
    minimum?: number;
    configurations?: readonly string[];
    reason_when?: ReasonRequirement;
    reason_values?: boolean;
    languages?: readonly string[];
    language_defaults?: Readonly<Record<string, unknown>>;
    default_all?: unknown;
    default?: unknown;
};

import type { z } from 'zod';
import type { TableSettings } from '#cli/types/settings/file.ts';
import type { REASON_DESCRIPTIONS } from '#cli/config/settings/fields.ts';
import { type ReasonedValue, type SettingLanguage } from '#cli/types/settings/tables.ts';

/**
 * The part of a setting definition that the schema keeps for a reasoned value: what the setting holds, and which change
 * needs a reason.
 */
export type ReasonedSettingDefinition = Required<Pick<SettingDefinition, 'description' | 'reason_needed'>>;

export type ReasonNeeded = keyof typeof REASON_DESCRIPTIONS;

/** The definition of one setting: its description, defaults, owning configurations, and the change that needs a reason. */
export type SettingDefinition = {
    description?: string;
    configurations?: readonly string[];
    reason_needed?: ReasonNeeded;
    reason_values?: boolean;
    languages?: readonly string[];
    language_defaults?: Readonly<Record<string, unknown>>;
    default_all?: unknown;
    default?: unknown;
};

/** The numeric field schemas built from the limit definitions. */
export type LimitSchemas = Record<
    keyof Omit<TableSettings<'limits'>, SettingLanguage>,
    z.ZodDefault<z.ZodUnion<readonly [z.ZodType<number, number>, z.ZodType<number, ReasonedValue<number>>]>>
>;

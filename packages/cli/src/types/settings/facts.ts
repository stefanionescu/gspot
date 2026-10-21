import type { z } from 'zod';
import type { TableSettings } from '#cli/types/settings/file.ts';
import type { REASON_DESCRIPTIONS } from '#cli/config/settings/schema.ts';
import { type ReasonedValue, type SettingLanguage } from '#cli/types/settings/tables.ts';

/** The schema metadata of a setting that takes a reasoned value: what it holds, and which change needs a reason. */
export type ReasonedSettingFacts = Required<Pick<SettingFacts, 'description' | 'reason_needed'>>;

export type ReasonNeeded = keyof typeof REASON_DESCRIPTIONS;

/** The facts shared by every setting's metadata entry. */
export type SettingFacts = {
    description?: string;
    configurations?: readonly string[];
    reason_needed?: ReasonNeeded;
    reason_values?: boolean;
    languages?: readonly string[];
    language_defaults?: Readonly<Record<string, unknown>>;
    default_all?: unknown;
    default?: unknown;
};

/** The numeric field schemas generated from the declared limit facts. */
export type LimitSchemas = Record<
    keyof Omit<TableSettings<'limits'>, SettingLanguage>,
    z.ZodDefault<z.ZodUnion<readonly [z.ZodType<number, number>, z.ZodType<number, ReasonedValue<number>>]>>
>;

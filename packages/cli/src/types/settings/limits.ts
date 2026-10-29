import type { z } from 'zod';
import type { TableSettings } from '#cli/types/settings/file.ts';
import { type ReasonedValue } from '#cli/types/settings/values.ts';
import { type SettingLanguage } from '#cli/types/settings/naming.ts';

export type LimitSchemas = Record<
    keyof Omit<TableSettings<'limits'>, SettingLanguage>,
    z.ZodDefault<z.ZodUnion<readonly [z.ZodType<number, number>, z.ZodType<number, ReasonedValue<number>>]>>
>;

import type { z } from 'zod';
import type { limitFields } from '#cli/schemas/settings/limits.ts';
import type { SettingLanguage } from '#cli/types/settings/naming.ts';
import type { TableSettings } from '#cli/types/settings/settings.ts';

export type ReasonedValue<Value> = { value: Value; reason: string };

type LimitLanguage = SettingLanguage;

export type LanguageLimitField = {
    [Field in keyof typeof limitFields]: z.ZodOptional<(typeof limitFields)[Field]>;
};

export type LanguageLimitSchemas = {
    [Language in LimitLanguage]: z.ZodOptional<z.ZodObject<LanguageLimitField>>;
};

export type ParsedStructure = TableSettings<'structure'>;

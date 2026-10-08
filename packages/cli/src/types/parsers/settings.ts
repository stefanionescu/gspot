import type { z } from 'zod';

import type {
    settingPrimitiveSchema,
    settingFieldOptionsSchema,
    settingValueDeclarationSchema,
} from '#cli/parsers/schema/settings.ts';

/** Compiler input derives its authored type names and constraints from one schema. */
export type SettingValueDeclaration = z.infer<typeof settingValueDeclarationSchema>;

export type SettingPrimitive = z.infer<typeof settingPrimitiveSchema>;

export type SettingFields = Record<string, SettingPrimitive | SettingField>;

export type SettingItems = 'string' | 'path' | SettingFields;

export type SettingField = z.infer<typeof settingFieldOptionsSchema> &
    ({ type: SettingPrimitive } | { type: 'list'; items: SettingItems } | { type: 'table'; fields: SettingFields });

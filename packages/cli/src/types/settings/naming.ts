import type { TableSettings } from '#cli/types/settings/settings.ts';
import type { NAMING_TABLE_CATEGORIES } from '#cli/config/settings/schema.ts';
import type { CASE_NAMES, NAMED_CATEGORIES, SETTING_LANGUAGES } from '#cli/config/manifests.ts';

export type NamedCategory = (typeof NAMED_CATEGORIES)[number];

export type NamingCase = (typeof CASE_NAMES)[number];

export type SettingLanguage = (typeof SETTING_LANGUAGES)[number];

export type NamingCategory = (typeof NAMING_TABLE_CATEGORIES)[number];

export type ParsedNamingLanguageFields = NonNullable<TableSettings<'naming'>[SettingLanguage]>;

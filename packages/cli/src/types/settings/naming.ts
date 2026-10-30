import type { TableSettings } from '#cli/types/settings/settings.ts';
import { type CASE_NAMES, type NAMED_CATEGORIES } from '#cli/config/manifests/manifests.ts';
import { type SETTING_LANGUAGES, type NAMING_TABLE_CATEGORIES } from '#cli/config/settings/naming.ts';

export type NamedCategory = (typeof NAMED_CATEGORIES)[number];

export type NamingCase = (typeof CASE_NAMES)[number];

export type SettingLanguage = (typeof SETTING_LANGUAGES)[number];

export type NamingCategory = (typeof NAMING_TABLE_CATEGORIES)[number];

export type ParsedNamingLanguageFields = NonNullable<TableSettings<'naming'>[SettingLanguage]>;

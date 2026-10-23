import { type CASE_NAMES, type NAMED_CATEGORIES } from '#cli/config/configurations/naming.ts';

import {
    type SETTING_LANGUAGES,
    type NAMING_TABLE_CATEGORIES,
    type NAMING_LANGUAGE_CATEGORIES,
} from '#cli/config/settings/naming.ts';

export type ParsedNamingOverride = {
    paths: string[];
    languages?: SettingLanguage[] | undefined;
    categories?: NamedCategory[] | undefined;
    ignored_prefix?: string | undefined;
    ignored_names_pattern?: string | undefined;
    allow_digits: boolean;
    allow_repeated_words: boolean;
    allowed_names?: string[] | undefined;
    cases?: NamingCase[] | undefined;
    reason: string;
};

export type NamedCategory = (typeof NAMED_CATEGORIES)[number];

export type NamingCase = (typeof CASE_NAMES)[number];

export type SettingLanguage = (typeof SETTING_LANGUAGES)[number];

export type NamingCategory = (typeof NAMING_TABLE_CATEGORIES)[number];

export type NamingFields<NumberValue, CaseValue> = {
    max_characters?: NumberValue | undefined;
    max_words?: NumberValue | undefined;
    cases?: CaseValue | undefined;
};

/** The naming categories that one language's table accepts. */
type NamingLanguageCategory<Language extends SettingLanguage> = (typeof NAMING_LANGUAGE_CATEGORIES)[Language][number];

export type NamingLanguageFields<
    NumberValue,
    CaseValue,
    Language extends SettingLanguage = SettingLanguage,
> = NamingFields<NumberValue, CaseValue> &
    Partial<Record<NamingLanguageCategory<Language>, NamingFields<NumberValue, CaseValue> | undefined>>;

export type ParsedNamingFields = { max_characters: number; max_words: number; cases: NamingCase[] };

export type ParsedNamingLanguageFields<Language extends SettingLanguage = SettingLanguage> = ParsedNamingFields &
    Partial<Record<NamingLanguageCategory<Language>, ParsedNamingFields | undefined>>;

export type ParsedNaming = ParsedNamingFields & {
    [Language in SettingLanguage]?: ParsedNamingLanguageFields<Language> | undefined;
} & {
    banned_words: string[];
    override: ParsedNamingOverride[];
};

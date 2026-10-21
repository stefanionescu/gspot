import type { Optional } from '#cli/types/shapes.ts';
import type { LEVELS } from '#cli/config/configurations.ts';
import type { LIMIT_FACTS } from '#cli/config/settings/limit-facts.ts';
import type { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';
import type { CASE_NAMES, NAMED_CATEGORIES } from '#cli/config/checks/naming.ts';

import type {
    CI_PROVIDERS,
    LINE_ENDINGS,
    QUOTE_STYLES,
    REEXPORT_MODES,
    TRAILING_COMMAS,
    SETTING_LANGUAGES,
    FORMAT_INDENT_STYLES,
    NAMING_TABLE_CATEGORIES,
    NAMING_LANGUAGE_CATEGORIES,
} from '#cli/config/settings/schema.ts';

export type ReasonedValue<Value> = { value: Value; reason: string };

export type SettingValue<Value> = Value | ReasonedValue<Value>;

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

export type LimitFields<NumberValue> = Partial<Record<keyof ParsedLimitFields, NumberValue | undefined>>;

type LimitFacts = (typeof LIMIT_FACTS)[keyof typeof LIMIT_FACTS];

/** The languages that at least one limit reads. */
export type LimitLanguage = Extract<LimitFacts, { languages: readonly string[] }>['languages'][number];

/** The limits that some code reads for one language. */
export type LanguageLimitField<Language extends LimitLanguage> = {
    [Key in keyof typeof LIMIT_FACTS]: (typeof LIMIT_FACTS)[Key] extends {
        languages: readonly (infer Languages)[];
    }
        ? Language extends Languages
            ? Key extends `limits.${infer Field}`
                ? Field
                : never
            : never
        : never;
}[keyof typeof LIMIT_FACTS];

/** One language's limit table: only the limits that the language reads, each inherited from the root when unset. */
export type LanguageLimitFields<Language extends LimitLanguage, NumberValue> = Partial<
    Record<LanguageLimitField<Language>, NumberValue | undefined>
>;

type ParsedLimitFields = {
    file_lines: number;
    function_lines: number;
    function_parameters: number;
    function_statements: number;
    block_nesting: number;
    callback_nesting: number;
    cognitive_complexity: number;
    cyclomatic_complexity: number;
    function_branches: number;
    function_returns: number;
    function_assignments: number;
    closure_lines: number;
    type_lines: number;
    index_exports: number;
    trivial_function_statements: number;
    shared_prefix_files: number;
};

export type ParsedLimits = ParsedLimitFields & {
    [Language in LimitLanguage]?: LanguageLimitFields<Language, number> | undefined;
};

export type ParsedNamingFields = { max_characters: number; max_words: number; cases: NamingCase[] };

export type ParsedNamingLanguageFields<Language extends SettingLanguage = SettingLanguage> = ParsedNamingFields &
    Partial<Record<NamingLanguageCategory<Language>, ParsedNamingFields | undefined>>;

export type ParsedNaming = ParsedNamingFields & {
    [Language in SettingLanguage]?: ParsedNamingLanguageFields<Language> | undefined;
} & {
    banned_words: string[];
    override: ParsedNamingOverride[];
};

export type ParsedFormat = {
    indent_style: (typeof FORMAT_INDENT_STYLES)[number];
    indent_width: number;
    print_width: number;
    line_ending: (typeof LINE_ENDINGS)[number];
    final_newline: boolean;
    quotes?: (typeof QUOTE_STYLES)[number] | undefined;
    trailing_commas: (typeof TRAILING_COMMAS)[number];
    semicolons: boolean;
    override: (Optional<Omit<ParsedFormat, 'override'>> & { paths: string[] })[];
};

export type ParsedRoot = {
    level: (typeof LEVELS)[number];
    allowed_words: Record<string, string>;
    removed_configurations: string[];
    tool_timeout_seconds: number;
    test_files: string[];
    configurations: string[];
};

export type ParsedStructure = { reexports: (typeof REEXPORT_MODES)[number]; environment_readers: string[] };

export type ParsedHooks = { enabled: boolean };

export type ParsedCi = {
    enabled: boolean;
    provider: (typeof CI_PROVIDERS)[number];
    setup_command?: string[] | undefined;
    operating_systems: (typeof OPERATING_SYSTEMS)[number]['name'][];
};

export type ParsedRules = { enabled: boolean; exclude: string[] };

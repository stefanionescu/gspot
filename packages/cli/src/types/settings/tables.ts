import type { LEVELS } from '#cli/config/configurations.ts';
import type { CASE_NAMES } from '#cli/config/checks/naming.ts';
import type { ParsedTools } from '#cli/types/settings/tool-tables.ts';
import type { ParsedNamingOverride } from '#cli/types/settings/file.ts';
import type { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';
import type { LIMITS_DECLARATIONS } from '#cli/config/settings/limits-declarations.ts';
import type { ConfigurationTables } from '#cli/types/settings/configuration-tables.ts';

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

type SettingDeclaration = {
    name: string;
    type: 'number' | 'string' | 'path' | 'boolean' | 'list' | 'table';
    path_role?: 'source' | 'destination' | 'build';
    default?: unknown;
    default_all?: unknown;
    language_defaults?: Record<string, unknown>;
    reason_needed?: 'raising' | 'lowering' | 'adding';
    reason_values?: boolean;
    summary: string;
    languages?: string[];
    categories?: string[];
    off_values?: (string | number | boolean)[];
};

type TableValues = {
    cloudflare?: ConfigurationTables['cloudflare'] | undefined;
    coverage?: ConfigurationTables['coverage'] | undefined;
    dependencies?: ConfigurationTables['dependencies'] | undefined;
    docs?: ConfigurationTables['docs'] | undefined;
    drizzle?: ConfigurationTables['drizzle'] | undefined;
    format: ParsedFormat;
    javascript?: ConfigurationTables['javascript'] | undefined;
    python?: ConfigurationTables['python'] | undefined;
    trpc?: ConfigurationTables['trpc'] | undefined;
    zustand?: ConfigurationTables['zustand'] | undefined;
    licenses?: ConfigurationTables['licenses'] | undefined;
    limits?: ParsedLimits | undefined;
    naming?: ParsedNaming | undefined;
    openapi?: ConfigurationTables['openapi'] | undefined;
    postgres?: ConfigurationTables['postgres'] | undefined;
    repository?: ConfigurationTables['repository'] | undefined;
    prose?: ConfigurationTables['prose'] | undefined;
    duplication?: ConfigurationTables['duplication'] | undefined;
    swift?: ConfigurationTables['swift'] | undefined;
    secrets?: ConfigurationTables['secrets'] | undefined;
    site?: ConfigurationTables['site'] | undefined;
    spelling?: ConfigurationTables['spelling'] | undefined;
    structure?: ParsedStructure | undefined;
    supabase?: ConfigurationTables['supabase'] | undefined;
    translations?: ConfigurationTables['translations'] | undefined;
    xcode?: ConfigurationTables['xcode'] | undefined;
    'tools.commitlint'?: NonNullable<ParsedTools['commitlint']> | undefined;
    'tools.editorconfig-checker'?: NonNullable<ParsedTools['editorconfig-checker']> | undefined;
    'tools.eslint'?: NonNullable<ParsedTools['eslint']> | undefined;
    'tools.hadolint'?: NonNullable<ParsedTools['hadolint']> | undefined;
    'tools.knip'?: NonNullable<ParsedTools['knip']> | undefined;
    'tools.markdownlint'?: NonNullable<ParsedTools['markdownlint']> | undefined;
    'tools.nginx'?: NonNullable<ParsedTools['nginx']> | undefined;
    'tools.prettier'?: NonNullable<ParsedTools['prettier']> | undefined;
    'tools.purgecss'?: NonNullable<ParsedTools['purgecss']> | undefined;
    'tools.ruff'?: NonNullable<ParsedTools['ruff']> | undefined;
    'tools.semgrep'?: NonNullable<ParsedTools['semgrep']> | undefined;
    'tools.shellcheck'?: NonNullable<ParsedTools['shellcheck']> | undefined;
    'tools.sqlfluff'?: NonNullable<ParsedTools['sqlfluff']> | undefined;
    'tools.squawk'?: NonNullable<ParsedTools['squawk']> | undefined;
    'tools.stylelint'?: NonNullable<ParsedTools['stylelint']> | undefined;
    'tools.swiftlint'?: NonNullable<ParsedTools['swiftlint']> | undefined;
    'tools.taplo'?: NonNullable<ParsedTools['taplo']> | undefined;
    'tools.trivy'?: NonNullable<ParsedTools['trivy']> | undefined;
    'tools.typos'?: NonNullable<ParsedTools['typos']> | undefined;
    'tools.v8r'?: NonNullable<ParsedTools['v8r']> | undefined;
    'tools.yamllint'?: NonNullable<ParsedTools['yamllint']> | undefined;
};

type TableName = keyof TableValues;
type TableSettings<Name extends TableName> = NonNullable<TableValues[Name]>;

type NamingCase = (typeof CASE_NAMES)[number];

type SettingLanguage = (typeof SETTING_LANGUAGES)[number];

type NamingCategory = (typeof NAMING_TABLE_CATEGORIES)[number];

type NamingFields<NumberValue, CaseValue> = {
    max_characters?: NumberValue | undefined;
    max_words?: NumberValue | undefined;
    cases?: CaseValue | undefined;
};

/** The naming categories that one language's table accepts. */
type NamingLanguageCategory<Language extends SettingLanguage> = (typeof NAMING_LANGUAGE_CATEGORIES)[Language][number];

type NamingLanguageFields<NumberValue, CaseValue, Language extends SettingLanguage = SettingLanguage> = NamingFields<
    NumberValue,
    CaseValue
> &
    Partial<Record<NamingLanguageCategory<Language>, NamingFields<NumberValue, CaseValue> | undefined>>;

type LimitFields<NumberValue> = Partial<Record<keyof ParsedLimitFields, NumberValue | undefined>>;

type LimitDeclaration = (typeof LIMITS_DECLARATIONS)[keyof typeof LIMITS_DECLARATIONS];

/** The languages that at least one limit reads. */
type LimitLanguage = Extract<LimitDeclaration, { languages: readonly string[] }>['languages'][number];

/** The limits that some code reads for one language. */
type LanguageLimitField<Language extends LimitLanguage> = {
    [Key in keyof typeof LIMITS_DECLARATIONS]: (typeof LIMITS_DECLARATIONS)[Key] extends {
        languages: readonly (infer Languages)[];
    }
        ? Language extends Languages
            ? Key extends `limits.${infer Field}`
                ? Field
                : never
            : never
        : never;
}[keyof typeof LIMITS_DECLARATIONS];

/** One language's limit table: only the limits that the language reads, each inherited from the root when unset. */
type LanguageLimitFields<Language extends LimitLanguage, NumberValue> = Partial<
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

type ParsedLimits = ParsedLimitFields & {
    [Language in LimitLanguage]?: LanguageLimitFields<Language, number> | undefined;
};

type ParsedNamingFields = { max_characters: number; max_words: number; cases: NamingCase[] };

type ParsedNamingLanguageFields<Language extends SettingLanguage = SettingLanguage> = ParsedNamingFields &
    Partial<Record<NamingLanguageCategory<Language>, ParsedNamingFields | undefined>>;

type ParsedNaming = ParsedNamingFields & {
    [Language in SettingLanguage]?: ParsedNamingLanguageFields<Language> | undefined;
} & {
    banned_words: string[];
    override: ParsedNamingOverride[];
};

type ParsedFormat = {
    indent_style: (typeof FORMAT_INDENT_STYLES)[number];
    indent_width: number;
    print_width: number;
    line_ending: (typeof LINE_ENDINGS)[number];
    final_newline: boolean;
    quotes?: (typeof QUOTE_STYLES)[number] | undefined;
    trailing_commas: (typeof TRAILING_COMMAS)[number];
    semicolons: boolean;
    override: {
        indent_style?: (typeof FORMAT_INDENT_STYLES)[number] | undefined;
        indent_width?: number | undefined;
        print_width?: number | undefined;
        line_ending?: (typeof LINE_ENDINGS)[number] | undefined;
        final_newline?: boolean | undefined;
        quotes?: (typeof QUOTE_STYLES)[number] | undefined;
        trailing_commas?: (typeof TRAILING_COMMAS)[number] | undefined;
        semicolons?: boolean | undefined;
        paths: string[];
    }[];
};

type ParsedRoot = {
    level: (typeof LEVELS)[number];
    allowed_words: Record<string, string>;
    removed_configurations: string[];
    tool_timeout_seconds: number;
    test_files: string[];
    configurations: string[];
};

type ParsedStructure = { reexports: (typeof REEXPORT_MODES)[number]; environment_readers: string[] };

type ParsedHooks = { enabled: boolean };

type ParsedCi = {
    enabled: boolean;
    provider: (typeof CI_PROVIDERS)[number];
    setup_command?: string[] | undefined;
    operating_systems: (typeof OPERATING_SYSTEMS)[number]['name'][];
};

type ParsedRules = { enabled: boolean; exclude: string[] };

export type {
    ParsedCi,
    TableName,
    NamingCase,
    ParsedRoot,
    TableValues,
    LimitFields,
    ParsedHooks,
    ParsedRules,
    NamingFields,
    ParsedLimits,
    ParsedNaming,
    ParsedFormat,
    TableSettings,
    LimitLanguage,
    NamingCategory,
    SettingLanguage,
    ParsedStructure,
    SettingDeclaration,
    LanguageLimitField,
    ParsedNamingFields,
    LanguageLimitFields,
    NamingLanguageFields,
    ParsedNamingLanguageFields,
};

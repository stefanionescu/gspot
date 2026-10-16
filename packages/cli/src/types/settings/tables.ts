import type { LEVELS } from '#cli/config/configurations.ts';
import type { ParsedSite } from '#cli/types/checks/framework.ts';
import type { ParsedSwift } from '#cli/types/checks/language.ts';
import type { ParsedPostgres } from '#cli/types/checks/database.ts';
import type { ParsedTools } from '#cli/types/settings/tool-tables.ts';
import type { CASE_NAMES } from '#cli/config/checks/general/naming.ts';
import type { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';
import type { ParsedXcode, ParsedOpenapi } from '#cli/types/checks/infrastructure.ts';
import type { ParsedDrizzle, ParsedTranslations } from '#cli/types/checks/library.ts';
import type { ParsedSupabase, ParsedCloudflare } from '#cli/types/checks/platform.ts';
import type { ArchitectureModule, ParsedNamingOverride } from '#cli/types/settings/file.ts';

import type {
    CI_PROVIDERS,
    LINE_ENDINGS,
    QUOTE_STYLES,
    REEXPORT_MODES,
    TRAILING_COMMAS,
    SETTING_LANGUAGES,
    FORMAT_INDENT_STYLES,
    NAMING_TABLE_CATEGORIES,
} from '#cli/config/settings/schema.ts';
import {
    type ParsedDocs,
    type ParsedProse,
    type ParsedSecrets,
    type ParsedCoverage,
    type ParsedLicenses,
    type ParsedSpelling,
    type ParsedRepository,
    type ParsedDuplication,
    type ParsedDependencies,
} from '#cli/types/checks/general.ts';

type SettingDeclaration = {
    name: string;
    type: 'number' | 'string' | 'path' | 'boolean' | 'list' | 'table';
    path_role?: 'source' | 'destination' | 'build';
    default?: unknown;
    default_all?: unknown;
    language_defaults?: Record<string, unknown>;
    reason_needed?: 'raising' | 'lowering' | 'adding';
    summary: string;
    languages?: string[];
    categories?: string[];
    off_values?: (string | number | boolean)[];
};

type TableValues = {
    architecture?: ParsedArchitecture | undefined;
    cloudflare?: ParsedCloudflare | undefined;
    coverage?: ParsedCoverage | undefined;
    dependencies?: ParsedDependencies | undefined;
    docs?: ParsedDocs | undefined;
    drizzle?: ParsedDrizzle | undefined;
    format: ParsedFormat;
    licenses?: ParsedLicenses | undefined;
    limits?: ParsedLimits | undefined;
    naming?: ParsedNaming | undefined;
    openapi?: ParsedOpenapi | undefined;
    postgres?: ParsedPostgres | undefined;
    repository?: ParsedRepository | undefined;
    prose?: ParsedProse | undefined;
    duplication?: ParsedDuplication | undefined;
    swift?: ParsedSwift | undefined;
    secrets?: ParsedSecrets | undefined;
    site?: ParsedSite | undefined;
    spelling?: ParsedSpelling | undefined;
    structure?: ParsedStructure | undefined;
    supabase?: ParsedSupabase | undefined;
    translations?: ParsedTranslations | undefined;
    xcode?: ParsedXcode | undefined;
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

type NamingLanguageFields<NumberValue, CaseValue> = NamingFields<NumberValue, CaseValue> &
    Partial<Record<NamingCategory, NamingFields<NumberValue, CaseValue> | undefined>>;

type LimitFields<NumberValue> = Partial<Record<keyof ParsedLimitFields, NumberValue | undefined>>;

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

type ParsedLimits = ParsedLimitFields & Partial<Record<SettingLanguage, ParsedLimitFields | undefined>>;

type ParsedNamingFields = { max_characters: number; max_words: number; cases: NamingCase[] };

type ParsedNamingLanguageFields = ParsedNamingFields & Partial<Record<NamingCategory, ParsedNamingFields | undefined>>;

type ParsedNaming = ParsedNamingFields &
    Partial<Record<SettingLanguage, ParsedNamingLanguageFields | undefined>> & {
        banned_words: string[];
        override: ParsedNamingOverride[];
    };

type ParsedArchitecture = {
    module: ArchitectureModule[];
    roles: { environment_readers: string[]; scripts: string[]; stores: string[]; routers: string[] };
};

type ParsedFormat = {
    indent_style: (typeof FORMAT_INDENT_STYLES)[number];
    indent_width: number;
    print_width: number;
    line_ending: (typeof LINE_ENDINGS)[number];
    final_newline: boolean;
    quotes: (typeof QUOTE_STYLES)[number];
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
    allowed_words: string[];
    removed_configurations: string[];
    tool_timeout_seconds: number;
    test_files: string[];
    configurations: string[];
};

type ParsedStructure = { reexports: (typeof REEXPORT_MODES)[number] };

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
    NamingCategory,
    SettingLanguage,
    ParsedStructure,
    SettingDeclaration,
    ParsedNamingFields,
    ParsedArchitecture,
    NamingLanguageFields,
};

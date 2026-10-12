import type { ParsedHtml } from '#cli/types/checks/language.ts';
import type { ParsedSite } from '#cli/types/checks/framework.ts';
import type { ParsedPostgres } from '#cli/types/checks/database.ts';
import type { ParsedTools } from '#cli/types/settings/tool-tables.ts';
import type { CASE_NAMES } from '#cli/config/checks/general/naming.ts';
import type { ParsedXcode, ParsedOpenapi } from '#cli/types/checks/infrastructure.ts';
import type { ParsedDrizzle, ParsedTranslations } from '#cli/types/checks/library.ts';
import type { ParsedSupabase, ParsedCloudflare } from '#cli/types/checks/platform.ts';
import type { ArchitectureModule, ParsedNamingOverride } from '#cli/types/settings/file.ts';
import type { PATH_ROLES, REASON_NEEDED, SETTING_TYPES } from '#cli/config/settings/values.ts';

import type {
    ParsedDocs,
    ParsedSecrets,
    ParsedCoverage,
    ParsedLicenses,
    ParsedSpelling,
    ParsedDependencies,
} from '#cli/types/checks/general.ts';
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

type SettingDeclaration = {
    name: string;
    type: (typeof SETTING_TYPES)[number];
    path_role?: (typeof PATH_ROLES)[number];
    default?: unknown;
    default_all?: unknown;
    language_defaults?: Record<string, unknown>;
    reason_needed?: (typeof REASON_NEEDED)[number];
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
    html?: ParsedHtml | undefined;
    licenses?: ParsedLicenses | undefined;
    limits?: ParsedLimits | undefined;
    naming?: ParsedNaming | undefined;
    openapi?: ParsedOpenapi | undefined;
    postgres?: ParsedPostgres | undefined;
    secrets?: ParsedSecrets | undefined;
    site?: ParsedSite | undefined;
    spelling?: ParsedSpelling | undefined;
    structure?: ParsedStructure | undefined;
    supabase?: ParsedSupabase | undefined;
    translations?: ParsedTranslations | undefined;
    xcode?: ParsedXcode | undefined;
    'tools.codeql'?: NonNullable<ParsedTools['codeql']> | undefined;
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
    'tools.svgo'?: NonNullable<ParsedTools['svgo']> | undefined;
    'tools.swiftlint'?: NonNullable<ParsedTools['swiftlint']> | undefined;
    'tools.taplo'?: NonNullable<ParsedTools['taplo']> | undefined;
    'tools.trivy'?: NonNullable<ParsedTools['trivy']> | undefined;
    'tools.typos'?: NonNullable<ParsedTools['typos']> | undefined;
    'tools.v8r'?: NonNullable<ParsedTools['v8r']> | undefined;
    'tools.yamllint'?: NonNullable<ParsedTools['yamllint']> | undefined;
};

type TableName = keyof TableValues;
type TableSettings<Name extends TableName> = NonNullable<TableValues[Name]>;

// Zod reads the path role from schema metadata.
declare module 'zod/v4/core' {
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- reason: Zod reads extra metadata types only from an interface.
    interface GlobalMeta {
        pathRole?: (typeof PATH_ROLES)[number];
    }
}

type NamingCase = (typeof CASE_NAMES)[number];

type NamingLanguage = (typeof SETTING_LANGUAGES)[number];

type NamingCategory = (typeof NAMING_TABLE_CATEGORIES)[number];

type NamingFields<NumberValue, CaseValue> = {
    max_characters?: NumberValue | undefined;
    max_words?: NumberValue | undefined;
    cases?: CaseValue | undefined;
};

type NamingLanguageFields<NumberValue, CaseValue> = NamingFields<NumberValue, CaseValue> &
    Partial<Record<NamingCategory, NamingFields<NumberValue, CaseValue> | undefined>>;

type LimitFields<NumberValue> = Partial<
    Record<
        | 'file_lines'
        | 'function_lines'
        | 'function_parameters'
        | 'statements'
        | 'nesting'
        | 'callback_nesting'
        | 'cognitive_complexity'
        | 'cyclomatic_complexity'
        | 'branches'
        | 'returns'
        | 'assignments'
        | 'closure_lines'
        | 'type_lines'
        | 'index_exports'
        | 'min_function_statements'
        | 'prefix_collisions'
        | 'file_kilobytes'
        | 'sentence_words'
        | 'list_item_words'
        | 'paragraph_sentences'
        | 'headings_before_contents'
        | 'min_duplicate_lines'
        | 'min_duplicate_tokens'
        | 'duplicate_percent',
        NumberValue | undefined
    >
>;

type ParsedLimitFields = {
    file_lines: number;
    function_lines: number;
    function_parameters: number;
    statements: number;
    nesting: number;
    callback_nesting: number;
    cognitive_complexity: number;
    cyclomatic_complexity: number;
    branches: number;
    returns: number;
    assignments: number;
    closure_lines: number;
    type_lines: number;
    index_exports: number;
    min_function_statements: number;
    prefix_collisions: number;
    file_kilobytes: number;
    sentence_words: number;
    list_item_words: number;
    paragraph_sentences: number;
    headings_before_contents: number;
    min_duplicate_lines: number;
    min_duplicate_tokens: number;
    duplicate_percent: number;
};

type ParsedLimits = ParsedLimitFields & Partial<Record<NamingLanguage, ParsedLimitFields | undefined>>;

type ParsedNamingFields = { max_characters: number; max_words: number; cases: NamingCase[] };

type ParsedNamingLanguageFields = ParsedNamingFields & Partial<Record<NamingCategory, ParsedNamingFields | undefined>>;

type ParsedNaming = ParsedNamingFields &
    Partial<Record<NamingLanguage, ParsedNamingLanguageFields | undefined>> & {
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
    level: 'recommended' | 'all';
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
    operating_systems: ('macos' | 'linux' | 'windows')[];
};

type ParsedRules = { enabled: boolean; exclude: string[]; instruction_files: string[] };

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
    NamingLanguage,
    NamingCategory,
    ParsedStructure,
    SettingDeclaration,
    ParsedNamingFields,
    ParsedArchitecture,
    NamingLanguageFields,
};

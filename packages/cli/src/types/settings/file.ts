import type { FileCopy } from '#cli/types/system/files.ts';
import type { Settings } from '#cli/types/settings/values.ts';
import type { Defined, Optional } from '#cli/types/objects.ts';
import type { ParsedSite } from '#cli/types/checks/framework.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { ParsedPostgres } from '#cli/types/checks/database.ts';
import type { REEXPORT_MODES } from '#cli/config/settings/schema.ts';
import type { OutputSpec, OutputInput } from '#cli/types/parsers/output.ts';
import type { ParsedTools, WrittenTools } from '#cli/types/settings/tool-tables.ts';
import type { ParsedXcode, ParsedOpenapi } from '#cli/types/checks/infrastructure.ts';
import type { ParsedDrizzle, ParsedTranslations } from '#cli/types/checks/library.ts';
import type { ParsedSupabase, ParsedCloudflare } from '#cli/types/checks/platform.ts';

import type {
    ParsedDocs,
    NamedCategory,
    ParsedSecrets,
    ParsedCoverage,
    ParsedLicenses,
    ParsedSpelling,
    ParsedDependencies,
} from '#cli/types/checks/general.ts';
import type {
    ParsedCi,
    ParsedRoot,
    NamingCase,
    ParsedHooks,
    ParsedRules,
    LimitFields,
    NamingFields,
    ParsedLimits,
    ParsedNaming,
    ParsedFormat,
    NamingLanguage,
    ParsedStructure,
    ParsedArchitecture,
    NamingLanguageFields,
} from '#cli/types/settings/tables.ts';

type TomlDate = { toISOString: () => string };

type WrittenCoverage = Optional<Omit<ParsedCoverage, 'lines' | 'branches' | 'functions' | 'statements'>> & {
    lines?: ReasonValue<number> | undefined;
    branches?: ReasonValue<number> | undefined;
    functions?: ReasonValue<number> | undefined;
    statements?: ReasonValue<number> | undefined;
};

type WrittenDependencies = Optional<Omit<ParsedDependencies, 'min_release_age_days' | 'allowed_registries'>> & {
    min_release_age_days?: ReasonValue<number> | undefined;
    allowed_registries?: ReasonValue<string[]> | undefined;
};

type WrittenDocs = Optional<Omit<ParsedDocs, 'allowed_urls'>> & { allowed_urls?: ReasonValue<string[]> | undefined };

type WrittenSite = Optional<Omit<ParsedSite, 'allowed_unlisted_pages'>> & {
    allowed_unlisted_pages?: ReasonValue<string[]> | undefined;
};

export type ReasonEnvelope<Value> = { value: Value; reason: string };

export type ReasonValue<Value> = Value | ReasonEnvelope<Value>;

export type WrittenLicenses = Optional<ParsedLicenses>;

export type WrittenLimits = LimitFields<ReasonValue<number>> &
    Optional<Record<NamingLanguage, LimitFields<ReasonValue<number>> | undefined>>;

export type ParsedNamingOverride = {
    paths: string[];
    languages?: NamingLanguage[] | undefined;
    categories?: NamedCategory[] | undefined;
    ignored_prefix?: string | undefined;
    allow_digits: boolean;
    allow_repeated_words: boolean;
    allowed_names?: string[] | undefined;
    cases?: NamingCase[] | undefined;
    reason: string;
};

export type WrittenNamingOverride = Optional<Omit<ParsedNamingOverride, 'reason'>> & { reason: string };

export type WrittenNaming = NamingFields<ReasonValue<number>, ReasonValue<NamingCase[]>> &
    Optional<
        Record<NamingLanguage, NamingLanguageFields<ReasonValue<number>, ReasonValue<NamingCase[]>> | undefined>
    > & {
        banned_words?: string[] | undefined;
        override?: WrittenNamingOverride[] | undefined;
    };

export type WrittenArchitecture = {
    module?: { name: string; paths: string[]; may_import?: string[] | undefined }[] | undefined;
    roles?: Optional<ParsedArchitecture['roles']> | undefined;
};

export type WrittenFormat = Optional<ParsedFormat>;

export type WrittenSettings = Optional<
    Omit<
        ParsedSettings,
        | 'allowed_words'
        | 'scope'
        | 'coverage'
        | 'dependencies'
        | 'docs'
        | 'site'
        | 'limits'
        | 'naming'
        | 'architecture'
        | 'tools'
        | 'format'
        | 'command_check'
        | 'structure'
        | 'hooks'
        | 'ci'
        | 'licenses'
        | 'rules'
        | 'cloudflare'
        | 'drizzle'
        | 'openapi'
        | 'postgres'
        | 'secrets'
        | 'spelling'
        | 'supabase'
        | 'translations'
        | 'xcode'
    >
> & {
    licenses?: WrittenLicenses | undefined;
    cloudflare?: Optional<ParsedCloudflare> | undefined;
    drizzle?: Optional<ParsedDrizzle> | undefined;
    openapi?: Optional<ParsedOpenapi> | undefined;
    postgres?: Optional<ParsedPostgres> | undefined;
    secrets?: Optional<ParsedSecrets> | undefined;
    spelling?: Optional<ParsedSpelling> | undefined;
    supabase?: Optional<ParsedSupabase> | undefined;
    translations?: Optional<ParsedTranslations> | undefined;
    xcode?: Optional<ParsedXcode> | undefined;
    allowed_words?: ReasonValue<string[]> | undefined;
    scope?: WrittenScope[] | undefined;
    coverage?: WrittenCoverage | undefined;
    dependencies?: WrittenDependencies | undefined;
    docs?: WrittenDocs | undefined;
    site?: WrittenSite | undefined;
    limits?: WrittenLimits | undefined;
    naming?: WrittenNaming | undefined;
    architecture?: WrittenArchitecture | undefined;
    tools?: WrittenTools | undefined;
    format?: WrittenFormat | undefined;
    command_check?:
        | {
              name: string;
              command: string[];
              paths: string[];
              stage: 'commit' | 'push' | 'manual';
              help?: string | undefined;
              fix?: string[] | undefined;
              exit_codes?: number[] | undefined;
              summary?: string | undefined;
              output?: OutputInput | undefined;
          }[]
        | undefined;
    structure?: { reexports?: ReasonValue<(typeof REEXPORT_MODES)[number]> | undefined } | undefined;
    hooks?: Optional<ParsedHooks> | undefined;
    ci?: Optional<ParsedCi> | undefined;
    rules?: Optional<ParsedRules> | undefined;
};

export type ParsedSettings = ParsedRoot & {
    scope?:
        | {
              path: string;
              configurations: string[];
              removed_configurations: string[];
              test_files?: string[] | undefined;
              cloudflare?: ParsedCloudflare | undefined;
              coverage?: Omit<ParsedCoverage, 'target'> | undefined;
              dependencies?: ParsedDependencies | undefined;
              docs?: Omit<ParsedDocs, 'banned_headings'> | undefined;
              drizzle?: ParsedDrizzle | undefined;
              licenses?: Omit<ParsedLicenses, 'allowed_package'> | undefined;
              openapi?: ParsedOpenapi | undefined;
              postgres?: ParsedPostgres | undefined;
              secrets?: ParsedSecrets | undefined;
              site?: Omit<ParsedSite, 'size_limit'> | undefined;
              spelling?: ParsedSpelling | undefined;
              supabase?: ParsedSupabase | undefined;
              translations?: ParsedTranslations | undefined;
              xcode?: ParsedXcode | undefined;
              limits?: ParsedLimits | undefined;
              naming?: Omit<ParsedNaming, 'override'> | undefined;
              architecture?: Omit<ParsedArchitecture, 'module'> | undefined;
              tools?:
                  | (Omit<ParsedTools, 'eslint' | 'v8r'> & {
                        eslint?: Omit<NonNullable<ParsedTools['eslint']>, 'override'> | undefined;
                    })
                  | undefined;
              format?: Omit<ParsedFormat, 'override'> | undefined;
          }[]
        | undefined;
    cloudflare?: ParsedCloudflare | undefined;
    coverage?: ParsedCoverage | undefined;
    dependencies?: ParsedDependencies | undefined;
    docs?: ParsedDocs | undefined;
    drizzle?: ParsedDrizzle | undefined;
    licenses?: ParsedLicenses | undefined;
    openapi?: ParsedOpenapi | undefined;
    postgres?: ParsedPostgres | undefined;
    secrets?: ParsedSecrets | undefined;
    site?: ParsedSite | undefined;
    spelling?: ParsedSpelling | undefined;
    supabase?: ParsedSupabase | undefined;
    translations?: ParsedTranslations | undefined;
    xcode?: ParsedXcode | undefined;
    limits?: ParsedLimits | undefined;
    naming?: ParsedNaming | undefined;
    architecture?: ParsedArchitecture | undefined;
    tools?: ParsedTools | undefined;
    format?: ParsedFormat | undefined;
    ignore?:
        | {
              check: string;
              rule?: string | undefined;
              paths?: string[] | undefined;
              reason: string;
              until?: TomlDate | undefined;
          }[]
        | undefined;
    command_check?:
        | {
              name: string;
              command: string[];
              paths: string[];
              stage: 'commit' | 'push' | 'manual';
              help?: string | undefined;
              fix?: string[] | undefined;
              exit_codes?: number[] | undefined;
              summary?: string | undefined;
              output: OutputSpec;
          }[]
        | undefined;
    structure?: ParsedStructure | undefined;
    hooks?: ParsedHooks | undefined;
    ci?: ParsedCi | undefined;
    rules: ParsedRules;
};

export type TemplateTables = Omit<WrittenSettings, 'scope'>;

export type Template = { source: string; text: string; digest: string; tables: TemplateTables };

export type ExportedTemplate = { text: string; leftOut: string[] };

export type SettingsSource = { text: string; original: FileCopy };

export type SettingsEdit = { text: string; table: TomlTable; values: TomlTable; original: FileCopy };

export type EditedSettings = { text: string; settings: Settings; changed: boolean; original: FileCopy };

export type Mutation = (written: TomlTable) => void;

export type SettingKey = { path: string[]; name: string };

/** A ordered header and its written values. */
export type LayoutSection = { path: KeyPath; table: TomlTable };

export type ArchitectureModule = { name: string; paths: string[]; may_import: string[] };

export type IgnoreEntry = NonNullable<ParsedSettings['ignore']>[number];

export type SettingsError = { path: KeyPath; message: string };

export type FormatSettings = Required<Defined<Omit<NonNullable<ParsedSettings['format']>, 'override'>>>;

export type ToolTable = Record<string, unknown>;

export type WrittenScope = Omit<
    WrittenSettings,
    | 'scope'
    | 'level'
    | 'allowed_words'
    | 'tool_timeout_seconds'
    | 'ignore'
    | 'command_check'
    | 'structure'
    | 'hooks'
    | 'ci'
    | 'rules'
    | 'coverage'
    | 'docs'
    | 'licenses'
    | 'site'
    | 'naming'
    | 'architecture'
    | 'tools'
    | 'format'
> & {
    path: string;
    coverage?: Omit<WrittenCoverage, 'target'> | undefined;
    docs?: Omit<WrittenDocs, 'banned_headings'> | undefined;
    licenses?: Omit<WrittenLicenses, 'allowed_package'> | undefined;
    site?: Omit<WrittenSite, 'size_limit'> | undefined;
    naming?: Omit<WrittenNaming, 'override'> | undefined;
    architecture?: Omit<WrittenArchitecture, 'module'> | undefined;
    tools?:
        | (Omit<WrittenTools, 'eslint' | 'v8r'> & {
              eslint?: Omit<NonNullable<WrittenTools['eslint']>, 'override'> | undefined;
          })
        | undefined;
    format?: Omit<WrittenFormat, 'override'> | undefined;
};

export type RuleExcludeError = { index: number; message: string };

export type TomlTable = Record<string, unknown>;

export type StylelintOptions = { severity?: 'error' | undefined };

import type { STAGES } from '#cli/config/configurations.ts';
import type { Defined, Optional } from '#cli/types/shapes.ts';
import { type NamedCategory } from '#cli/types/checks/naming.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { REEXPORT_MODES } from '#cli/config/settings/schema.ts';
import type { OutputSpec, OutputInput } from '#cli/types/runs/output.ts';
import type { ImportRule, WrittenImportRule } from '#cli/types/settings/imports.ts';
import type { ParsedTools, WrittenTools } from '#cli/types/settings/tool-tables.ts';
import type { ConfigurationTables } from '#cli/types/settings/configuration-tables.ts';

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
    LimitLanguage,
    SettingLanguage,
    ParsedStructure,
    LanguageLimitFields,
    NamingLanguageFields,
} from '#cli/types/settings/tables.ts';

type CommandCheckFields = {
    name: string;
    command: string[];
    paths: string[];
    outputs?: string[] | undefined;
    stage: Exclude<(typeof STAGES)[number], 'message'>;
    help?: string | undefined;
    fix?: string[] | undefined;
    exit_codes?: number[] | undefined;
    summary?: string | undefined;
};

type TomlDate = { toISOString: () => string };

type WrittenCoverage = Optional<
    Omit<ConfigurationTables['coverage'], 'lines' | 'branches' | 'functions' | 'statements'>
> & {
    lines?: SettingValue<number> | undefined;
    branches?: SettingValue<number> | undefined;
    functions?: SettingValue<number> | undefined;
    statements?: SettingValue<number> | undefined;
};

type WrittenDependencies = Optional<
    Omit<ConfigurationTables['dependencies'], 'min_release_age_days' | 'allowed_registries'>
> & {
    min_release_age_days?: SettingValue<number> | undefined;
    allowed_registries?: SettingValue<string[]> | undefined;
};

type WrittenDocs = Optional<Omit<ConfigurationTables['docs'], 'allowed_urls'>> & {
    allowed_urls?: SettingValue<string[]> | undefined;
};

type WrittenSite = Optional<Omit<ConfigurationTables['site'], 'allowed_unlisted_pages'>> & {
    allowed_unlisted_pages?: SettingValue<string[]> | undefined;
};

type WrittenStructure = Optional<{
    reexports: SettingValue<(typeof REEXPORT_MODES)[number]>;
    environment_readers: string[];
}>;

export type ReasonedValue<Value> = { value: Value; reason: string };

export type SettingValue<Value> = Value | ReasonedValue<Value>;

export type WrittenLicenses = Optional<ConfigurationTables['licenses']>;

export type WrittenLimits = LimitFields<SettingValue<number>> & {
    [Language in LimitLanguage]?: LanguageLimitFields<Language, SettingValue<number>> | undefined;
};

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

export type WrittenNamingOverride = Optional<Omit<ParsedNamingOverride, 'reason'>> & { reason: string };

export type WrittenNaming = NamingFields<SettingValue<number>, SettingValue<NamingCase[]>> & {
    [Language in SettingLanguage]?:
        | NamingLanguageFields<SettingValue<number>, SettingValue<NamingCase[]>, Language>
        | undefined;
} & {
    banned_words?: string[] | undefined;
    override?: WrittenNamingOverride[] | undefined;
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
        | 'import_rule'
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
        | 'javascript'
        | 'python'
        | 'trpc'
        | 'zustand'
        | 'openapi'
        | 'postgres'
        | 'secrets'
        | 'spelling'
        | 'supabase'
        | 'translations'
        | 'xcode'
        | 'swift'
        | 'duplication'
        | 'prose'
        | 'repository'
    >
> & {
    licenses?: WrittenLicenses | undefined;
    cloudflare?: Optional<ConfigurationTables['cloudflare']> | undefined;
    drizzle?: Optional<ConfigurationTables['drizzle']> | undefined;
    javascript?: Optional<ConfigurationTables['javascript']> | undefined;
    python?: Optional<ConfigurationTables['python']> | undefined;
    trpc?: Optional<ConfigurationTables['trpc']> | undefined;
    zustand?: Optional<ConfigurationTables['zustand']> | undefined;
    openapi?: Optional<ConfigurationTables['openapi']> | undefined;
    postgres?: Optional<ConfigurationTables['postgres']> | undefined;
    secrets?: Optional<ConfigurationTables['secrets']> | undefined;
    spelling?: Optional<ConfigurationTables['spelling']> | undefined;
    supabase?: Optional<ConfigurationTables['supabase']> | undefined;
    translations?: Optional<ConfigurationTables['translations']> | undefined;
    xcode?: Optional<ConfigurationTables['xcode']> | undefined;
    swift?: Optional<ConfigurationTables['swift']> | undefined;
    duplication?:
        | { min_lines?: SettingValue<number> | undefined; min_tokens?: SettingValue<number> | undefined }
        | undefined;
    prose?:
        | {
              max_sentence_words?: SettingValue<number> | undefined;
              max_list_item_words?: SettingValue<number> | undefined;
              max_paragraph_sentences?: SettingValue<number> | undefined;
          }
        | undefined;
    repository?: { max_file_kilobytes?: SettingValue<number> | undefined } | undefined;
    allowed_words?: Record<string, string> | undefined;
    scope?: WrittenScope[] | undefined;
    coverage?: WrittenCoverage | undefined;
    dependencies?: WrittenDependencies | undefined;
    docs?: WrittenDocs | undefined;
    site?: WrittenSite | undefined;
    limits?: WrittenLimits | undefined;
    naming?: WrittenNaming | undefined;
    import_rule?: WrittenImportRule[] | undefined;
    tools?: WrittenTools | undefined;
    format?: WrittenFormat | undefined;
    command_check?: (CommandCheckFields & { output?: OutputInput | undefined })[] | undefined;
    structure?: WrittenStructure | undefined;
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
              cloudflare?: ConfigurationTables['cloudflare'] | undefined;
              coverage?: Omit<ConfigurationTables['coverage'], 'swift_target'> | undefined;
              dependencies?: ConfigurationTables['dependencies'] | undefined;
              docs?: Omit<ConfigurationTables['docs'], 'banned_headings'> | undefined;
              drizzle?: ConfigurationTables['drizzle'] | undefined;
              javascript?: ConfigurationTables['javascript'] | undefined;
              python?: ConfigurationTables['python'] | undefined;
              trpc?: ConfigurationTables['trpc'] | undefined;
              zustand?: ConfigurationTables['zustand'] | undefined;
              structure?: Pick<ParsedStructure, 'environment_readers'> | undefined;
              licenses?: Omit<ConfigurationTables['licenses'], 'allowed_package'> | undefined;
              openapi?: ConfigurationTables['openapi'] | undefined;
              postgres?: ConfigurationTables['postgres'] | undefined;
              duplication?: ConfigurationTables['duplication'] | undefined;
              prose?: ConfigurationTables['prose'] | undefined;
              repository?: ConfigurationTables['repository'] | undefined;
              secrets?: ConfigurationTables['secrets'] | undefined;
              site?: Omit<ConfigurationTables['site'], 'size_limit'> | undefined;
              spelling?: ConfigurationTables['spelling'] | undefined;
              supabase?: ConfigurationTables['supabase'] | undefined;
              translations?: ConfigurationTables['translations'] | undefined;
              xcode?: ConfigurationTables['xcode'] | undefined;
              swift?: ConfigurationTables['swift'] | undefined;
              limits?: ParsedLimits | undefined;
              naming?: Omit<ParsedNaming, 'override'> | undefined;
              tools?:
                  | (Omit<ParsedTools, 'eslint' | 'v8r'> & {
                        eslint?: Omit<NonNullable<ParsedTools['eslint']>, 'override' | 'plugins'> | undefined;
                    })
                  | undefined;
              format?: Omit<ParsedFormat, 'override'> | undefined;
          }[]
        | undefined;
    cloudflare?: ConfigurationTables['cloudflare'] | undefined;
    coverage?: ConfigurationTables['coverage'] | undefined;
    dependencies?: ConfigurationTables['dependencies'] | undefined;
    docs?: ConfigurationTables['docs'] | undefined;
    drizzle?: ConfigurationTables['drizzle'] | undefined;
    javascript?: ConfigurationTables['javascript'] | undefined;
    python?: ConfigurationTables['python'] | undefined;
    trpc?: ConfigurationTables['trpc'] | undefined;
    zustand?: ConfigurationTables['zustand'] | undefined;
    licenses?: ConfigurationTables['licenses'] | undefined;
    openapi?: ConfigurationTables['openapi'] | undefined;
    postgres?: ConfigurationTables['postgres'] | undefined;
    duplication?: ConfigurationTables['duplication'] | undefined;
    prose?: ConfigurationTables['prose'] | undefined;
    repository?: ConfigurationTables['repository'] | undefined;
    secrets?: ConfigurationTables['secrets'] | undefined;
    site?: ConfigurationTables['site'] | undefined;
    spelling?: ConfigurationTables['spelling'] | undefined;
    supabase?: ConfigurationTables['supabase'] | undefined;
    translations?: ConfigurationTables['translations'] | undefined;
    xcode?: ConfigurationTables['xcode'] | undefined;
    swift?: ConfigurationTables['swift'] | undefined;
    limits?: ParsedLimits | undefined;
    naming?: ParsedNaming | undefined;
    import_rule: ImportRule[];
    tools?: ParsedTools | undefined;
    format?: ParsedFormat | undefined;
    ignore?:
        | {
              check?: string | undefined;
              rule?: string | undefined;
              names?: string[] | undefined;
              paths?: string[] | undefined;
              reason: string;
              until?: TomlDate | undefined;
          }[]
        | undefined;
    command_check?: (CommandCheckFields & { output: OutputSpec })[] | undefined;
    structure?: ParsedStructure | undefined;
    hooks?: ParsedHooks | undefined;
    ci?: ParsedCi | undefined;
    rules: ParsedRules;
};

export type IgnoreRecord = NonNullable<ParsedSettings['ignore']>[number];

export type SettingsError = { path: KeyPath; message: string };

export type FormatSettings = Required<Defined<Omit<NonNullable<ParsedSettings['format']>, 'override' | 'quotes'>>> &
    Pick<NonNullable<ParsedSettings['format']>, 'quotes'>;

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
    | 'import_rule'
    | 'tools'
    | 'format'
> & {
    path: string;
    coverage?: Omit<WrittenCoverage, 'swift_target'> | undefined;
    docs?: Omit<WrittenDocs, 'banned_headings'> | undefined;
    licenses?: Omit<WrittenLicenses, 'allowed_package'> | undefined;
    site?: Omit<WrittenSite, 'size_limit'> | undefined;
    naming?: Omit<WrittenNaming, 'override'> | undefined;
    structure?: { environment_readers?: string[] | undefined } | undefined;
    tools?:
        | (Omit<WrittenTools, 'eslint' | 'v8r'> & {
              eslint?: Omit<NonNullable<WrittenTools['eslint']>, 'override' | 'plugins'> | undefined;
          })
        | undefined;
    format?: Omit<WrittenFormat, 'override'> | undefined;
};

export type TomlTable = Record<string, unknown>;

export type RuleExcludeError = { index: number; message: string };

export type StylelintOptions = { severity?: 'error' | undefined };

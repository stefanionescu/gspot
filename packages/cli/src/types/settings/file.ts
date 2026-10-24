import type { Check } from '#cli/types/configurations.ts';
import type { STAGES } from '#cli/config/configurations/names.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { REEXPORT_MODES } from '#cli/config/settings/tables.ts';
import type { ImportRule } from '#cli/types/settings/import-rules.ts';
import type { ConfigurationTables } from '#cli/types/settings/tables.ts';
import type { Defined, Optional, SchemaShape } from '#cli/types/shapes.ts';
import type { CheckOutput, WrittenOutput } from '#cli/types/runs/output.ts';
import type { ParsedTools, WrittenTools } from '#cli/types/settings/tools.ts';

import type {
    NamingCase,
    NamingFields,
    ParsedNaming,
    SettingLanguage,
    ParsedNamingOverride,
    NamingLanguageFields,
} from '#cli/types/settings/naming.ts';
import type {
    ParsedCi,
    ParsedRoot,
    ParsedRules,
    ParsedHooks,
    LimitFields,
    ParsedLimits,
    ParsedFormat,
    SettingValue,
    LimitLanguage,
    ParsedStructure,
    LanguageLimitFields,
} from '#cli/types/settings/values.ts';

export type TableValues = {
    [Name in keyof ConfigurationTables]?: ConfigurationTables[Name] | undefined;
} & {
    [Tool in keyof ParsedTools as `tools.${Tool}`]?: NonNullable<ParsedTools[Tool]> | undefined;
} & {
    format: ParsedFormat;
    limits?: ParsedLimits | undefined;
    naming?: ParsedNaming | undefined;
    structure?: ParsedStructure | undefined;
};

export type ToolTableSchemas = Pick<SchemaShape<TableValues>, `tools.${keyof ParsedTools}`>;

export type TableSettings<Name extends keyof TableValues> = NonNullable<TableValues[Name]>;

export type SettingsFile = {
    settings: Settings;
    text: string;
};

type StructureSettings = Defined<Required<NonNullable<ParsedSettings['structure']>>>;

export type Settings = Omit<
    ParsedSettings,
    | 'scope'
    | 'command_check'
    | 'tools'
    | 'limits'
    | 'naming'
    | 'import_rule'
    | 'structure'
    | 'format'
    | 'hooks'
    | 'ci'
    | 'rules'
    | 'ignore'
> & {
    written: TomlTable;
    level: NonNullable<ParsedSettings['level']>;
    configurations: string[];
    removed_configurations: string[];
    limits: NonNullable<ParsedSettings['limits']>;
    naming: NonNullable<ParsedSettings['naming']>;
    import_rule: ImportRule[];
    structure: StructureSettings;
    format: ParsedFormat;
    tools: Record<string, TomlTable>;
    test_files: string[];
    ignore: IgnoreRecord[];
    commandChecks: Record<string, CommandCheck>;
    hooks?: Defined<Required<NonNullable<ParsedSettings['hooks']>>>;
    ci?: ParsedCi;
    rules: ParsedRules;
    scopes: Record<string, NonNullable<ParsedSettings['scope']>[number] & Pick<Settings, 'written'>>;
};

export type CommandCheck = Check & {
    command: string[];
    files: NonNullable<Check['files']>;
};

export type SettingsTable = Settings | Settings['scopes'][string];

type CommandCheckFields = {
    id: string;
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

type WrittenReasonedTables = {
    coverage: WrittenCoverage;
    dependencies: WrittenDependencies;
    docs: WrittenDocs;
    site: WrittenSite;
    duplication: { min_lines?: SettingValue<number> | undefined; min_tokens?: SettingValue<number> | undefined };
    prose: {
        max_sentence_words?: SettingValue<number> | undefined;
        max_list_item_words?: SettingValue<number> | undefined;
        max_paragraph_sentences?: SettingValue<number> | undefined;
    };
    repository: { max_file_kilobytes?: SettingValue<number> | undefined };
};

type WrittenConfigurationTables = {
    [Name in keyof ConfigurationTables]?:
        | (Name extends keyof WrittenReasonedTables ? WrittenReasonedTables[Name] : Optional<ConfigurationTables[Name]>)
        | undefined;
};

type RootOnlyFields =
    | 'scope'
    | 'level'
    | 'tool_timeout_seconds'
    | 'ignore'
    | 'command_check'
    | 'hooks'
    | 'ci'
    | 'rules'
    | 'import_rule';

type ParsedScopeTables = {
    limits: ParsedLimits;
    dependencies: Omit<ConfigurationTables['dependencies'], 'min_release_age_days'>;
    coverage: Omit<ConfigurationTables['coverage'], 'swift_target'>;
    docs: Omit<ConfigurationTables['docs'], 'banned_headings'>;
    licenses: Omit<ConfigurationTables['licenses'], 'allowed_package'>;
    site: Omit<ConfigurationTables['site'], 'size_limit'>;
    naming: Omit<ParsedNaming, 'override'>;
    structure: Pick<ParsedStructure, 'environment_readers'>;
    tools: Omit<ParsedTools, 'eslint' | 'v8r'> & {
        eslint?: Omit<NonNullable<ParsedTools['eslint']>, 'override'> | undefined;
    };
    format: Omit<ParsedFormat, 'override'>;
};

type ParsedScope = Omit<ParsedSettings, RootOnlyFields | 'test_files' | keyof ParsedScopeTables> &
    Optional<ParsedScopeTables> & {
        path: string;
        test_files?: string[] | undefined;
    };

export type WrittenLicenses = Optional<ConfigurationTables['licenses']>;

export type WrittenLimits = LimitFields<SettingValue<number>> & {
    [Language in LimitLanguage]?: LanguageLimitFields<Language, SettingValue<number>> | undefined;
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
        | keyof ConfigurationTables
        | 'removed_configurations'
        | 'scope'
        | 'limits'
        | 'naming'
        | 'import_rule'
        | 'tools'
        | 'format'
        | 'command_check'
        | 'structure'
        | 'hooks'
        | 'ci'
        | 'rules'
    >
> &
    WrittenConfigurationTables & {
        removed_configurations?: SettingValue<string[]> | undefined;
        scope?: WrittenScope[] | undefined;
        limits?: WrittenLimits | undefined;
        naming?: WrittenNaming | undefined;
        import_rule?: ImportRule[] | undefined;
        tools?: WrittenTools | undefined;
        format?: WrittenFormat | undefined;
        command_check?: (CommandCheckFields & { output?: WrittenOutput | undefined })[] | undefined;
        structure?: WrittenStructure | undefined;
        hooks?: Optional<ParsedHooks> | undefined;
        ci?: Optional<ParsedCi> | undefined;
        rules?: Optional<ParsedRules> | undefined;
    };

export type ParsedSettings = ParsedRoot & {
    [Name in keyof ConfigurationTables]?: ConfigurationTables[Name] | undefined;
} & {
    scope?: ParsedScope[] | undefined;
    limits: ParsedLimits;
    naming: ParsedNaming;
    import_rule: ImportRule[];
    tools?: ParsedTools | undefined;
    format: ParsedFormat;
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
    command_check?: (CommandCheckFields & { output: CheckOutput })[] | undefined;
    structure: ParsedStructure;
    hooks?: ParsedHooks | undefined;
    ci?: ParsedCi | undefined;
    rules: ParsedRules;
};

export type IgnoreRecord = NonNullable<ParsedSettings['ignore']>[number];

export type SettingsError = { path: KeyPath; message: string };

export type FormatSettings = Required<Defined<Omit<NonNullable<ParsedSettings['format']>, 'override' | 'quotes'>>> &
    Pick<NonNullable<ParsedSettings['format']>, 'quotes'>;

export type WrittenScope = Omit<WrittenSettings, RootOnlyFields | keyof ParsedScopeTables> & {
    path: string;
    dependencies?: Omit<WrittenDependencies, 'min_release_age_days'> | undefined;
    coverage?: Omit<WrittenCoverage, 'swift_target'> | undefined;
    docs?: Omit<WrittenDocs, 'banned_headings'> | undefined;
    licenses?: Omit<WrittenLicenses, 'allowed_package'> | undefined;
    site?: Omit<WrittenSite, 'size_limit'> | undefined;
    naming?: Omit<WrittenNaming, 'override'> | undefined;
    structure?: { environment_readers?: string[] | undefined } | undefined;
    tools?:
        | (Omit<WrittenTools, 'eslint' | 'v8r'> & {
              eslint?: Omit<NonNullable<WrittenTools['eslint']>, 'override'> | undefined;
          })
        | undefined;
    format?: Omit<WrittenFormat, 'override'> | undefined;
};

export type TomlTable = Record<string, unknown>;

export type StylelintOptions = { severity?: 'error' | undefined };

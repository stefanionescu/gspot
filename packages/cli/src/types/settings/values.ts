import type { Defined } from '#cli/types/shapes.ts';
import type { Scope } from '#cli/types/repository/inventory.ts';
import type { ImportRule } from '#cli/types/settings/imports.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';
import type { TomlTable, IgnoreRecord, WrittenFormat, ParsedSettings } from '#cli/types/settings/file.ts';
import type { ParsedCi, ParsedRules, TableValues, SettingDeclaration } from '#cli/types/settings/tables.ts';

type ScopeSelection = {
    scope: Scope;
    selected: Manifest[];
    known: KnownSettings;
    view: ScopeView;
};

type SettingsFile = {
    settings: Settings;
    text: string;
};

/** Values validated once for one scope, then read by checks and generators. */
type ScopeSettings = {
    settings: Record<string, unknown>;
    values: TableValues;
    test_files: Settings['test_files'];
};

type ScopeView = {
    configurations: string[];
    test_files: Settings['test_files'];
    settings: Record<string, unknown>;
    values: TableValues;
    ignores: (IgnoreRecord & { paths: string[] })[];
};

type EffectiveSetting = {
    key: string;
    declaration: SettingDeclaration;
    value: unknown;
    reason?: string;
    source: string;
    origin: 'root' | 'scope' | 'configuration' | 'unset';
    originScope?: string;
    scope?: string;
};

/** Where a resolved value stands after the reader applies some tables. */
type SettingState = Pick<EffectiveSetting, 'value' | 'source' | 'origin' | 'originScope'> & {
    reason: string | undefined;
};

type KnownSettings = {
    declarations: Map<string, SettingDeclaration>;
    defaults: Map<string, SettingDefault>;
    errors: { key: string; message: string }[];
};

/** A written key matched to its declaration and its declared language and category. */
type DeclarationMatch = { declaration: SettingDeclaration; language?: string; category?: string };

type StructureSettings = Defined<Required<NonNullable<ParsedSettings['structure']>>>;

type Settings = Omit<
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
    /** Validated source table before execution defaults and normalization. */
    written: TomlTable;
    level: NonNullable<ParsedSettings['level']>;
    configurations: string[];
    removed_configurations: string[];
    limits: NonNullable<ParsedSettings['limits']>;
    naming: NonNullable<ParsedSettings['naming']>;
    import_rule: ImportRule[];
    structure: StructureSettings;
    format: WrittenFormat;
    allowed_words: NonNullable<ParsedSettings['allowed_words']>;
    tools: Record<string, TomlTable>;
    test_files: string[];
    ignore: IgnoreRecord[];
    commandChecks: Record<string, CommandCheck>;
    hooks?: Defined<Required<NonNullable<ParsedSettings['hooks']>>>;
    ci?: ParsedCi;
    rules: ParsedRules;
    scopes: Record<string, NonNullable<ParsedSettings['scope']>[number] & Pick<Settings, 'written'>>;
};

type WrittenSetting = Pick<EffectiveSetting, 'value' | 'reason'>;

type CommandCheck = CheckDeclaration & {
    command: string[];
    files: NonNullable<CheckDeclaration['files']>;
};

/** Root or scoped values and their source-document location. */
type SettingsTable = Settings | Settings['scopes'][string];

type WrittenScopeTable = { table: SettingsTable; scope?: string; path: KeyPath };

/** A setting default and the configuration responsible for it. */
type SettingDefault = { value: unknown; configuration: string };

/** Transform or observe one declared path without changing its role. */
type PathVisitor = (path: string, keys: KeyPath, role: NonNullable<SettingDeclaration['path_role']>) => string;

/** A written table and its defaults, while defaults get dropped in order. */
type WrittenTable = { scope: string; table: TomlTable; known: KnownSettings };

export type {
    Settings,
    ScopeView,
    PathVisitor,
    SettingsFile,
    SettingState,
    CommandCheck,
    WrittenTable,
    ScopeSettings,
    KnownSettings,
    SettingsTable,
    ScopeSelection,
    WrittenSetting,
    SettingDefault,
    EffectiveSetting,
    DeclarationMatch,
    WrittenScopeTable,
};

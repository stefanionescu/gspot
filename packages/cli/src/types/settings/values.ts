import type { Defined } from '#cli/types/shapes.ts';
import type { Scope } from '#cli/types/repository/inventory.ts';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';

import type {
    ParsedCi,
    TableName,
    ParsedRules,
    TableValues,
    TableSettings,
    SettingDeclaration,
} from '#cli/types/settings/tables.ts';
import type {
    TomlTable,
    ToolTable,
    IgnoreRecord,
    WrittenFormat,
    FormatSettings,
    ParsedSettings,
    ArchitectureModule,
} from '#cli/types/settings/file.ts';

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

/** Values validated once for a selected scope and then consumed by checks and generators. */
type ScopeSettings = {
    settings: Record<string, unknown>;
    values: TableValues;
    limits: LimitTable;
    test_files: Settings['test_files'];
};

type ScopeView = {
    configurations: string[];
    test_files: Settings['test_files'];
    settings: Record<string, unknown>;
    format: FormatSettings;
    roles: Settings['architecture']['roles'];
    limit: (key: string, language?: string) => number;
    values: TableValues;
    options: <Name extends TableName>(name: Name) => TableSettings<Name>;
    ignoresFor: (check: string) => (IgnoreRecord & { paths: string[] })[];
    rulesOff: (check: string) => string[];
    extra: (name: string) => Record<string, unknown> | undefined;
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

type LimitTable = Record<string, number>;

type Settings = Omit<
    ParsedSettings,
    | 'scope'
    | 'command_check'
    | 'tools'
    | 'limits'
    | 'naming'
    | 'architecture'
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
    architecture: ArchitectureSettings;
    structure: StructureSettings;
    format: WrittenFormat;
    allowed_words: NonNullable<ParsedSettings['allowed_words']>;
    tools: Record<string, ToolTable>;
    test_files: string[];
    ignore: IgnoreRecord[];
    commandChecks: Record<string, CommandCheck>;
    hooks?: Defined<Required<NonNullable<ParsedSettings['hooks']>>>;
    ci?: ParsedCi;
    rules: ParsedRules;
    scopes: Record<string, Partial<Settings> & Pick<Settings, 'written' | 'configurations' | 'removed_configurations'>>;
};

type WrittenSetting = Pick<EffectiveSetting, 'value' | 'reason'>;

type CommandCheck = CheckDeclaration & {
    command: string[];
    files: NonNullable<CheckDeclaration['files']>;
};

type ArchitectureSettings = Omit<Defined<Required<NonNullable<ParsedSettings['architecture']>>>, 'module'> & {
    module: ArchitectureModule[];
};

/** Root or scoped values and their source-document location. */
type WrittenScopeTable = { table: Partial<Settings> & Pick<Settings, 'written'>; scope?: string; path: KeyPath };

/** A setting default and the configuration responsible for it. */
type SettingDefault = { value: unknown; configuration: string };

/** Transform or observe one declared path without changing its role. */
type PathVisitor = (path: string, keys: KeyPath, role: NonNullable<SettingDeclaration['path_role']>) => string;

/** An written origin and its actual selected defaults during ordered omission. */
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
    ScopeSelection,
    WrittenSetting,
    SettingDefault,
    EffectiveSetting,
    DeclarationMatch,
    WrittenScopeTable,
};

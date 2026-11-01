import type { z } from 'zod';
import type { CST } from 'yaml';
import type { Tree, Node } from 'web-tree-sitter';
import type { RunCache } from '#cli/types/system.ts';
import type { ProseRoute } from '#cli/types/tools.ts';
import type { formatSchema } from '#cli/schemas/settings/fields.ts';
import type { Check, Configuration } from '#cli/types/manifests.ts';
import type { Config, TrackedFile } from '#cli/types/repository.ts';
import type { ConfigurationTables } from '#cli/types/engine/plan.ts';
import type { namingOverrideSchema } from '#cli/schemas/manifests/tools.ts';
import type { CASE_NAMES, NAMED_CATEGORIES } from '#cli/config/manifests.ts';
import type { Finding, Substitutions } from '#cli/types/engine/tool-runs.ts';
import type { pythonLicenseOutputSchema } from '#cli/schemas/configurations.ts';
import type { SqlFile, NumberedLine, ParsedTsconfig } from '#cli/types/parsers.ts';
import type { IGNORE_SECTION_TITLES } from '#cli/config/configurations/registry.ts';
import type { Level, ImportRule, TableSettings, SettingLanguage } from '#cli/types/settings.ts';
import type { ConfigOutput, PlannedConfig, FormatSettings } from '#cli/types/configurations/language.ts';

export type GeneratorRun = {
    substitutions: Substitutions;
    commandText: string;
    declaration: string[];
    patterns: string[];
    named: string[];
    targets: GeneratorOutput[];
    selected: string[];
};

export type TypeScriptReferenceCopy = {
    root: string;
    copyRoot: string;
    cache: RunCache;
    projects: Map<string, ParsedTsconfig>;
};

export type YamlFinding = { offset: number; rule: string; message: string };

export type YamlAnchorToken = Pick<CST.SourceToken, 'offset' | 'source'>;

export type TaskNames = { mise: Set<string>; scripts: Set<string>; binaries: Set<string> };

export type PathIndex = {
    paths: Set<string>;
    isIgnored: (path: string) => boolean;
    tasks: TaskNames;
};

export type ProseLine = NumberedLine & { command: boolean };

export type SuppressionSyntax = {
    covered: ReadonlySet<string>;
    tool: string;
    marker: RegExp;
    inlineMarker: RegExp;
    extractReason: (text: string) => string | undefined;
    forbidden: boolean;
    separator: RegExp | undefined;
    allRules: RegExp | undefined;
    limitRules: RegExp | undefined;
};

export type LicensedPackage = { name: string; license: string };

export type AllowedPackage = ConfigurationTables['licenses']['allowed_package'][number];

export type ProjectLicenses = {
    dependencyFile: string;
    packages: LicensedPackage[];
    locked: string[];
    ecosystem: 'npm' | 'python';
    settings: ConfigurationTables['licenses'];
};

export type PythonLicenseOutput = z.infer<typeof pythonLicenseOutputSchema>[number];

export type ProseRouteBatch = [ProseRoute, ...ProseRoute[]];

export type ValeAlert = { file: string; line: number; column: number; check: string; message: string };

export type BannedWord = {
    word: string;
    words: string[];
    setting: string;
    list?: string;
    categories?: string[];
    firstWord?: boolean;
};

export type FileNaming = { settings: NamingSettings; isTestFile: boolean };

export type CheckedIdentifier = FileNaming & { identifier: Identifier; place: FindingPlace; prefix: string };

export type CompiledOverride = {
    matches: (path: string) => boolean;
    languages: Set<string> | undefined;
    categories: Set<string> | undefined;
    allowedNames: Set<string> | undefined;
    digitsAllowed: boolean;
    repeatedWordsAllowed: boolean;
    ignoredPrefix: RegExp | undefined;
    ignoredNames: RegExp | undefined;
    cases: NamingCase[] | undefined;
};

export type CategoryLimits = { cases: NamingCase[]; maxCharacters: number; maxWords: number };

export type NamingSettings = {
    bannedWords: BannedWord[];
    allowedPhrases: string[][];
    overrides: CompiledOverride[];
    limitLookup: (language: string, category: string) => CategoryLimits;
};

export type NamedFile = { file: TrackedFile; language: string };

export type FileNames = {
    path: string;
    stem: string;
    declarations: Identifier[];
    folders: Identifier[];
};

export type Identifier = {
    file: string;
    line: number;
    column: number;
    language: string;
    category: NamedCategory;
    label: string;
    name: string;
    folder?: string;
    addedCases?: NamingCase[];
};

export type SqlName = { category: NamedCategory; name: string; location?: number; offset?: number };

export type FileIdentifiers = { file: string; language: string; identifiers: Identifier[] };

export type IdentifierRead = { identifiers: Identifier[]; error: SqlFile['error'] };

export type NamingCheck = { scope: { settings: { test_files: string[] } } };

export type ParsedLanguage = 'python' | 'swift' | 'bash';

export type FolderChild = { name: string; kind: 'file' | 'folder' };

export type ParsedSource = { path: string; language: ParsedLanguage; tree: Tree; captures: Map<string, Node[]> };

export type LocatedImport = { module: string; path: string; node: Node };

export type ImportOwners = { node: Node; module: string; owners: (number | undefined)[] };

export type PythonSearch = { files: ReadonlySet<string>; roots: string[]; externals: ReadonlySet<string> };

export type SwiftModule = { name: string; files: string[] };

export type RuleLookup = { rules: ImportRule[]; findOwner: (path: string) => number | undefined; allowed: string[][] };

export type TopLevelFunction = { name: string; isPrivate: boolean };

export type FindingPlace = Pick<Finding, 'file' | 'line' | 'column'>;

type SemgrepRule = Record<string, unknown> & { id: string; paths?: { include: string[] } };

export type SemgrepDocument = { rules: SemgrepRule[] };

export type RuleOptionsRun = {
    configured: string[];
    running: ReadonlySet<string>;
    allLevelRules: ReadonlySet<string>;
    level: Level;
};

export type ConfigBuilder = (planned: PlannedConfig) => string | ConfigOutput;

export type IgnoreSection = { key: keyof typeof IGNORE_SECTION_TITLES | 'settings'; title: string; patterns: string[] };

export type FormatOverride = {
    files: string[];
    excludeFiles: string[];
    options: Record<string, unknown>;
};

export type ScopeFormat = { scope: string; paths: string[]; format: Optional<FormatSettings> };

export type SourcedConfig = Extract<Config, { source: string }>;

export type GeneratorOutput = NonNullable<Check['generator_outputs']>[number];

export type PathContainer = NonNullable<Configuration['naming']>['path_containers'][number];

export type NamingOverride = z.infer<typeof namingOverrideSchema>;

export type NamedCategory = (typeof NAMED_CATEGORIES)[number];

export type NamingCase = (typeof CASE_NAMES)[number];

export type ParsedNamingLanguageFields = NonNullable<TableSettings<'naming'>[SettingLanguage]>;

export type WrittenFormat = z.input<typeof formatSchema>;

type Optional<Value> = { [Key in keyof Value]?: Value[Key] | undefined };

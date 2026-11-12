import type { Node } from 'web-tree-sitter';
import type { z } from 'zod';

import type { IGNORE_SECTION_TITLES } from '#cli/config/configurations/shared.ts';
import type { CASE_NAMES, NAMED_CATEGORIES } from '#cli/config/manifests.ts';
import type { NAMING_LANGUAGE_CATEGORIES } from '#cli/config/settings/schema.ts';
import type { namingExceptionSchema } from '#cli/schemas/manifests/tools.ts';
import type { formatSchema } from '#cli/schemas/settings/fields.ts';
import type { ConfigOutput, FormatSettings, PlannedConfig } from '#cli/types/configurations/language.ts';
import type { ConfigurationTables } from '#cli/types/engine/plan.ts';
import type { Finding } from '#cli/types/engine/run.ts';
import type { Substitutions } from '#cli/types/engine/tool-runs.ts';
import type { Check, Config, Configuration } from '#cli/types/manifests.ts';
import type { NumberedLine, ParsedTsconfig, SqlFile } from '#cli/types/parsers.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { ImportRule, Level, TableSettings } from '#cli/types/settings.ts';
import type { RunCache } from '#cli/types/system.ts';
import type { ProseRoute } from '#cli/types/tools.ts';

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

export type AllowedPackage = ConfigurationTables['licenses']['allowed_package'][number];

export type LockedPackage = {
    file: string;
    line: number;
    name: string;
    version: string;
    isPython: boolean;
    licenses: string[];
};

export type ProseRouteBatch = [ProseRoute, ...ProseRoute[]];

export type CommitMessage = { text: string; prefix: string };

export type BannedWord = {
    word: string;
    words: string[];
    setting: string;
    list?: string;
    categories?: string[];
    firstWord?: boolean;
    replacement?: string;
};

export type FileNaming = { settings: NamingSettings; isTestFile: boolean };

export type CheckedIdentifier = FileNaming & { identifier: Identifier; place: FindingPlace; prefix: string };

export type CompiledException = {
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
    exceptions: CompiledException[];
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

export type ParsedSource = { path: string; language: ParsedLanguage; rootNode: Node; captures: Map<string, Node[]> };

export type LocatedImport = { module: string; path: string; node: Node };

export type ImportOwners = { node: Node; module: string; owners: Array<number | undefined> };

export type PythonSearch = { files: ReadonlySet<string>; roots: string[]; externals: ReadonlySet<string> };

export type SwiftModule = { name: string; files: string[] };

export type RuleLookup = { rules: ImportRule[]; findOwner: (path: string) => number | undefined; allowed: string[][] };

export type TopLevelFunction = { name: string; isPrivate: boolean };

export type FindingPlace = Pick<Finding, 'file' | 'line' | 'column'>;

export type Weakening = { rule: string; file: string; change: string; reason?: string | undefined };

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

export type ScopeFormat = { scopePath: string; paths: string[]; format: Optional<FormatSettings> };

export type SourcedConfig = Extract<Config, { source: string }>;

export type GeneratorOutput = NonNullable<Check['generator_outputs']>[number];

export type PathContainer = NonNullable<Configuration['naming']>['path_containers'][number];

export type NamingException = z.infer<typeof namingExceptionSchema>;

export type NamedCategory = (typeof NAMED_CATEGORIES)[number];

export type NamingCase = (typeof CASE_NAMES)[number];

export type ParsedNamingLanguageFields = NonNullable<TableSettings<'naming'>[keyof typeof NAMING_LANGUAGE_CATEGORIES]>;

export type WrittenFormat = z.input<typeof formatSchema>;

type Optional<Value> = { [Key in keyof Value]?: Value[Key] | undefined };

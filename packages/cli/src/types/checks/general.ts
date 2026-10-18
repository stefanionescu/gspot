import type { Node, Tree } from 'web-tree-sitter';
import type { SqlFile } from '#cli/types/parsers/sql.ts';
import type { NamingCase } from '#cli/types/settings/tables.ts';
import type { COVERAGE_DIMENSIONS } from '#cli/config/planning.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import type { SPELLING_LOCALES } from '#cli/config/settings/schema.ts';
import type { CheckInput, FindingPlace } from '#cli/types/runs/check.ts';
import type { ACRONYM_STYLES, NAMED_CATEGORIES } from '#cli/config/checks/general/naming.ts';

type AllowedPackage = { name: string; version: string; reason: string };

/** The task names that mise, package scripts, and installed binaries offer in one project. */
export type TaskNames = { mise: Set<string>; packages: Set<string>; binaries: Set<string> };

/** Repository paths and per-project task definitions used by documentation validation. */
export type PathIndex = {
    known: Set<string>;
    tasks: TaskNames;
};

export type LicensedPackage = { name: string; license: string };

/** Installed dependency licenses associated with the project that owns them. */
export type ProjectLicenses = {
    dependencyFile: string;
    packages: LicensedPackage[];
    packageKey: (name: string) => string;
    configuration: ParsedLicenses;
};

/** A banned word split into parts, with where it came from. */
export type BannedWord = { word: string; parts: string[]; setting: string; group?: string; categories?: string[] };

/** The naming settings and the test-file status. */
export type NamingInputs = Pick<CheckInput, 'check'> & {
    settings: NamingSettings;
    isTestFile: boolean;
};

/** The input and finding location that the checks of one identifier share. */
export type NamingContext = NamingInputs & { identifier: Identifier; place: FindingPlace; prefix: string };

/** A path-scoped rule, compiled. */
export type CompiledOverride = {
    matches: (path: string) => boolean;
    languages: Set<string> | undefined;
    categories: Set<string> | undefined;
    allowedNames: Set<string> | undefined;
    isDigitsAllowed: boolean;
    isRepeatAllowed: boolean;
    ignoredPrefix: RegExp | undefined;
    cases: NamingCase[] | undefined;
    origin: string;
};

/** The limits and cases one identifier category gets. */
export type CategoryLimits = { caseNames: NamingCase[]; maxChars: number; maxWords: number };

/** The settings after merging gspot.toml, ready to validate against. */
export type NamingSettings = {
    bannedWords: BannedWord[];
    allowedPhrases: string[][];
    reserved: Map<string, string[]>;
    overrides: CompiledOverride[];
    limitsFor: (language: string, category: string) => CategoryLimits;
    isDigitsAllowed: boolean;
    isRepeatAllowed: boolean;
};

/** Framework punctuation removed before checking the name of a path segment. */
export type PathContainer = { open: string; close: string; category: NamedCategory };

/** A source file and its language configuration. */
export type NamedFile = { file: TrackedFile; language: string };
/** Identifier spellings associated with one file for cross-project comparisons. */
export type FileNames = { path: string; names: string[]; declarations: string[] };

export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };

/** A nonempty set of path routes or one stdin route. */
export type ProseRouteGroup = [ProseRoute, ...ProseRoute[]];

/** The validated shipped naming settings. */
export type NamingDefaults = {
    path_containers: PathContainer[];
    allow_digits: boolean;
    allow_repeated_words: boolean;
    groups: Record<string, { terms: string[] }>;
    reserved: Record<string, string[]>;
    allowed_names: string[];
    allowed_phrases: string[];
    languages: Record<
        string,
        { acronyms: (typeof ACRONYM_STYLES)[number]; categories: Record<string, { cases: NamingCase[] }> }
    >;
    override: NamingOverride[];
};

/** The table of one language in the shipped settings. */
export type NamingDefaultsLanguage = NamingDefaults['languages'][string];

/** One path-specific naming rule in settings or shipped configuration data. */
export type NamingOverride = {
    paths?: string[] | undefined;
    languages?: string[] | undefined;
    categories?: string[] | undefined;
    ignored_prefix?: string | undefined;
    allow_digits?: boolean | undefined;
    allow_repeated_words?: boolean | undefined;
    allowed_names?: string[] | undefined;
    cases?: NamingCase[] | undefined;
    reason?: string | undefined;
};

/** One identifier an extractor found. */
export type Identifier = {
    file: string;
    line: number;
    column: number;
    language: string;
    category: NamedCategory;
    /** The label a finding prints, such as `typescript function`. */
    label: string;
    name: string;
    /** For a folder name: the folder path, so a path rule can match it. */
    folder?: string;
};

/** A declaration before attaching its file, language, and display label. */
export type IdentifierDeclaration = Omit<Identifier, 'file' | 'language' | 'label'>;

/** One name a statement declares, with its naming category. */
export type SqlNamed = { category: NamedCategory; name: string; location?: number; offset?: number };

/** Where an extractor puts what it finds. */
export type ExtractSink = { file: string; language: string; out: Identifier[] };

export type CountedLanguage = 'python' | 'swift' | 'bash';

export type IsSubstantial = (node: Node, language: CountedLanguage, limit: number) => boolean;

/** A tracked folder entry. */
export type FolderEntry = { name: string; kind: 'file' | 'folder' };

export type ValeAlert = { file: string; line: number; column: number; check: string; message: string };

/** Parsed trees and their captures used by the convention checks. */
export type ConventionSource = { path: string; language: CountedLanguage; tree: Tree; captures: Map<string, Node[]> };

/** The imported environment object or function that a name refers to. */
export type EnvironmentKind = 'os' | 'environ' | 'getenv' | undefined;

export type EnvironmentScope = Map<string, EnvironmentKind>;

export type EnvironmentNames = Map<number, EnvironmentScope>;

export type SuppressionSyntax = {
    covers: (file: TrackedFile) => boolean;
    tool: string;
    marker: RegExp;
    inlineMarker: RegExp;
    reason: RegExp;
    forbidden: boolean;
};

export type NamedCategory = (typeof NAMED_CATEGORIES)[number];

export type ParsedCoverage = Record<(typeof COVERAGE_DIMENSIONS)[number], number> & {
    swift_target: { name: string; lines: number; reason?: string | undefined }[];
};

export type ParsedDependencies = {
    min_release_age_days: number;
    allowed_registries: string[];
    bun_scanner?: string | undefined;
};

export type ParsedDocs = { banned_headings: string[]; allowed_urls: string[] };

export type ParsedLicenses = { allowed: string[]; allowed_package: AllowedPackage[] };

export type ParsedSecrets = { env_examples: string[]; environment_functions: string[] };

export type ParsedSpelling = { locale: (typeof SPELLING_LOCALES)[number] };

/** Declarations or the located SQL syntax failure that prevented extraction. */
export type IdentifierRead = { identifiers: Identifier[]; error: SqlFile['error'] };

export type ParsedRepository = { max_file_kilobytes: number };
export type ParsedProse = { max_sentence_words: number; max_list_item_words: number; max_paragraph_sentences: number };
export type ParsedDuplication = { min_lines: number; min_tokens: number };

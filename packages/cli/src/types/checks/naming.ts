import type { SqlFile } from '#cli/types/parsers/sql.ts';
import type { NamingCase } from '#cli/types/settings/tables.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { CheckInput, FindingPlace } from '#cli/types/runs/check.ts';
import type { ACRONYM_STYLES, NAMED_CATEGORIES } from '#cli/config/checks/naming.ts';

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
    ignoredNames: RegExp | undefined;
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
    ignored_names_pattern?: string | undefined;
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
    extraCases?: NamingCase[];
};

/** A declaration before attaching its file, language, and display label. */
export type IdentifierDeclaration = Omit<Identifier, 'file' | 'language' | 'label'>;

/** One name a statement declares, with its naming category. */
export type SqlNamed = { category: NamedCategory; name: string; location?: number; offset?: number };

/** Where an extractor puts what it finds. */
export type ExtractSink = { file: string; language: string; out: Identifier[] };

export type NamedCategory = (typeof NAMED_CATEGORIES)[number];

/** Declarations or the located SQL syntax failure that prevented extraction. */
export type IdentifierRead = { identifiers: Identifier[]; error: SqlFile['error'] };

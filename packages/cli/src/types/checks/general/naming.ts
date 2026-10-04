import type { NamingLanguage } from '#cli/types/parsers/naming.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';

/** A banned term split into parts, with where it came from. */
export type Term = { term: string; parts: string[]; source: string };

/** One thing wrong with one identifier. */
export type NameProblem = {
    rule:
        | 'case'
        | 'digits'
        | 'length'
        | 'words'
        | 'duplicate-words'
        | 'banned-term'
        | 'reserved-term'
        | 'callback-verb';
    message: string;
    source?: string;
};

/** What the engine needs to check a file's identifiers: the policy and the language the file belongs to. */
export type NamingInputs = { policy: EffectivePolicy; isReactFile: boolean; isTestFile: boolean };

/** A path-scoped rule, compiled. */
export type PathRule = {
    matches: (path: string) => boolean;
    languages: Set<string> | undefined;
    categories: Set<string> | undefined;
    names: Set<string> | undefined;
    excludes: boolean;
    isDigitsAllowed: boolean;
    allowsRepeats: boolean;
    structuralPrefix: RegExp | undefined;
    caseNames: string[] | undefined;
    source: string;
};

/** The ceilings and cases one identifier category gets. */
export type CategoryLimits = { caseNames: string[]; maxChars: number; maxWords: number };

/** The policy after gspot.toml is merged in, ready to validate against. */
export type EffectivePolicy = {
    terms: Term[];
    reserved: Map<string, string[]>;
    external: Set<string>;
    allowed: Map<string, string | undefined>;
    contractProperties: Map<string, Set<string>>;
    rules: PathRule[];
    languages: Record<string, NamingLanguage>;
    limitsFor: (language: string, category: string) => CategoryLimits;
    isDigitsBanned: boolean;
    isDuplicatesBanned: boolean;
};

/** Framework punctuation removed before a path segment's name is checked. */
export type PathContainer = { open: string; close: string; category: string };

/** A selected source file and its owning language configuration. */
export type NamingSource = { file: TrackedFile; language: string };
/** Identifier spellings associated with one file for cross-project comparisons. */
export type FileNames = { path: string; names: string[] };

// The types of checks/naming in this package.

/** One identifier an extractor found. */
export type Identifier = {
    file: string;
    line: number;
    column: number;
    language: string;
    category: string;
    /** The label a finding prints, such as `typescript function`. */
    kind: string;
    name: string;
    /** For a directory name: the directory path, so a path rule can match it. */
    directory?: string;
};
/** Where an extractor puts what it finds. */
export type ExtractSink = { file: string; language: string; out: Identifier[] };
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
export type NamingContext = { policy: EffectivePolicy; isReactFile: boolean; isTestFile: boolean };
/** The shipped policy file, packages/cli/configurations/policy/naming/policy.json. */
export type ShippedPolicy = {
    version: number;
    matching: { wholeParts: boolean; caseInsensitive: boolean };
    banDigits: boolean;
    banDuplicateWords: boolean;
    groups: Record<string, { removable: boolean; terms: string[] }>;
    reserved: { term: string; allowedFor: string[] }[];
    external: string[];
    languages: Record<string, ShippedLanguage>;
    rules: ShippedRule[];
};
/** One language's table in the shipped policy. */
export type ShippedLanguage = {
    maxChars: number;
    maxWords: number;
    acronyms: 'word' | 'initialism' | 'lower';
    categories: Record<string, { case: string[] }>;
};
/** One path-scoped rule in the shipped policy. */
export type ShippedRule = {
    paths: string[];
    languages?: string[] | undefined;
    categories?: string[] | undefined;
    names?: string[] | undefined;
    exclude?: boolean | undefined;
    reason?: string | undefined;
    allowDigits?: boolean | undefined;
    allowDuplicateWords?: boolean | undefined;
    structuralPrefix?: string | undefined;
    case?: string[] | undefined;
};
/** A banned term split into parts, with where it came from. */
export type Term = { term: string; parts: string[]; source: string };
/** A path-scoped rule, compiled. */
export type PathRule = {
    isPath: (path: string) => boolean;
    languages: Set<string> | undefined;
    categories: Set<string> | undefined;
    names: Set<string> | undefined;
    isExcluding: boolean;
    isDigitsAllowed: boolean;
    isDuplicatesAllowed: boolean;
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
    languages: Record<string, ShippedLanguage>;
    limitsFor: (language: string, category: string) => CategoryLimits;
    isDigitsBanned: boolean;
    isDuplicatesBanned: boolean;
};

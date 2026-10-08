import type { Identifier } from '#cli/types/parsers/naming.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { FindingPlace } from '#cli/types/parsers/output.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';

/** A banned term split into parts, with where it came from. */
export type Term = { term: string; parts: string[]; source: string; group?: string };

/** The naming policy and whether this is a React file or a test file. */
export type NamingInputs = Pick<CheckInput, 'check'> & {
    policy: EffectivePolicy;
    isReactFile: boolean;
    isTestFile: boolean;
};

/** The input and diagnostic location shared by the checks of one identifier. */
export type NamingContext = NamingInputs & { identifier: Identifier; place: FindingPlace; prefix: string };

/** A path-scoped rule, compiled. */
export type PathRule = {
    matches: (path: string) => boolean;
    languages: Set<string> | undefined;
    categories: Set<string> | undefined;
    names: Set<string> | undefined;
    allowed: Set<string> | undefined;
    isDigitsAllowed: boolean;
    isRepeatAllowed: boolean;
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
    allowed: Map<string, string | undefined>;
    rules: PathRule[];
    limitsFor: (language: string, category: string) => CategoryLimits;
    isDigitsAllowed: boolean;
    isRepeatAllowed: boolean;
};

/** Framework punctuation removed before a path segment's name is checked. */
export type PathContainer = { open: string; close: string; category: string };

/** A selected source file and its owning language configuration. */
export type NamingSource = { file: TrackedFile; language: string };
/** Identifier spellings associated with one file for cross-project comparisons. */
export type FileNames = { path: string; names: string[] };

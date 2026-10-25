import type { Check } from '#cli/types/configurations.ts';
import type { FindingPlace } from '#cli/types/runs/check.ts';
import type { SqlFile } from '#cli/types/parsers/code/sql.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import type { NamingCase, NamedCategory } from '#cli/types/settings/naming.ts';

export type BannedWord = { word: string; words: string[]; setting: string; group?: string; categories?: string[] };

export type FileNaming = { check: Check; settings: NamingSettings; isTestFile: boolean };

export type CheckedIdentifier = FileNaming & { identifier: Identifier; place: FindingPlace; prefix: string };

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
};

export type CategoryLimits = { caseNames: NamingCase[]; maxChars: number; maxWords: number };

export type NamingSettings = {
    bannedWords: BannedWord[];
    allowedPhrases: string[][];
    overrides: CompiledOverride[];
    limitsFor: (language: string, category: string) => CategoryLimits;
};

export type NamedFile = { file: TrackedFile; language: string };

export type FileNames = {
    path: string;
    stem: string;
    names: string[];
    declarations: string[] | undefined;
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

export type SqlNamed = { category: NamedCategory; name: string; location?: number; offset?: number };

export type FileIdentifiers = { file: string; language: string; out: Identifier[] };

export type IdentifierRead = { identifiers: Identifier[]; error: SqlFile['error'] };

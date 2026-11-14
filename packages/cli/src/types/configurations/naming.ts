import type { z } from 'zod';
import type { SqlFile } from '#cli/types/parsers.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { TableSettings } from '#cli/types/settings.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import type { FindingPlace } from '#cli/types/configurations/general.ts';
import type { CASE_NAMES, NAMED_CATEGORIES } from '#cli/config/manifests.ts';
import type { namingExceptionSchema } from '#cli/schemas/manifests/fields.ts';
import type { NAMING_LANGUAGE_CATEGORIES } from '#cli/config/settings/tables.ts';

export type BannedWord = {
    word: string;
    words: string[];
    setting: string;
    list?: string;
    categories?: string[];
    firstWord?: boolean;
    wholeName?: boolean;
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
    isTestFile: (path: string) => boolean;
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
    name: string;
    folder?: string;
    addedCases?: NamingCase[];
    ignoredPrefix?: RegExp;
};

export type SqlName = { category: NamedCategory; name: string; location?: number; offset?: number };

export type FileIdentifiers = { file: string; language: string; identifiers: Identifier[] };

export type IdentifierRead = { identifiers: Identifier[]; error: SqlFile['error'] };

export type PathContainer = NonNullable<Configuration['naming']>['path_containers'][number];

export type NamingException = z.infer<typeof namingExceptionSchema>;

export type NamedCategory = (typeof NAMED_CATEGORIES)[number];

export type NamingCase = (typeof CASE_NAMES)[number];

export type ParsedNamingLanguageFields = NonNullable<TableSettings<'naming'>[keyof typeof NAMING_LANGUAGE_CATEGORIES]>;

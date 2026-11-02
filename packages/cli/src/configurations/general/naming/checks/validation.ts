import { NUMERIC_WORDS } from '#cli/config/system.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { splitWords, formatNameList } from '#cli/system/text.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { SQL_EXTENSION } from '#cli/config/configurations/infrastructure.ts';

import type {
    BannedWord,
    NamingCase,
    Identifier,
    FileNaming,
    NamingCheck,
    CategoryLimits,
    NamingSettings,
    CompiledOverride,
    CheckedIdentifier,
} from '#cli/types/configurations/general.ts';
import {
    RULES,
    DIGIT,
    SILENT_E,
    TRAILING_Y,
    UPPER_WORD,
    CAMEL_WORD,
    LOWER_WORD,
    DIGITS_ONLY,
    PASCAL_WORD,
    VOWEL_SUFFIX,
    LAST_EXTENSION,
    TEST_WORD_LIST,
    RUFF_CATEGORIES,
    MIGRATION_DIGITS,
    BANNED_WORD_FORMS,
    CAMEL_ACRONYM_WORD,
    WORD_FORM_SUFFIXES,
    PASCAL_ACRONYM_WORD,
    WORD_FORM_CONSONANT,
    SWIFTLINT_CATEGORIES,
} from '#cli/config/configurations/naming.ts';

function isSnakeMigration(name: string): boolean {
    const stamp = name.slice(0, MIGRATION_DIGITS);
    const rest = name.slice(MIGRATION_DIGITS);
    if (!DIGITS_ONLY.test(stamp) || !rest.startsWith('_') || !rest.endsWith(SQL_EXTENSION)) return false;
    const stem = rest.slice(1, -SQL_EXTENSION.length);
    return stem !== '' && stem.split('_').every((word) => LOWER_WORD.test(word));
}

const CASE_TESTS = {
    camel: (name) => CAMEL_WORD.test(name),
    'camel-acronym': (name) => CAMEL_ACRONYM_WORD.test(name),
    pascal: (name) => PASCAL_WORD.test(name),
    'pascal-acronym': (name) => PASCAL_ACRONYM_WORD.test(name),
    'pascal-extension': (name) => name.includes('+') && name.split('+').every((word) => PASCAL_ACRONYM_WORD.test(word)),
    kebab: (name) => name !== '' && name.split('-').every((word) => LOWER_WORD.test(word)),
    snake: (name) => name !== '' && name.split('_').every((word) => LOWER_WORD.test(word)),
    'upper-snake': (name) => name !== '' && name.split('_').every((word) => UPPER_WORD.test(word)),
    'timestamp-snake': isSnakeMigration,
} satisfies Record<NamingCase, (name: string) => boolean>;

function isInflectedForm(word: string, base: string): boolean {
    if (word === base) return true;
    if (
        base.endsWith(SILENT_E) &&
        WORD_FORM_SUFFIXES.some((suffix) => VOWEL_SUFFIX.test(suffix) && word === base.slice(0, -1) + suffix)
    )
        return true;
    if (base.endsWith(TRAILING_Y) && ['ies', 'ied'].some((suffix) => word === base.slice(0, -1) + suffix)) return true;
    const forms = WORD_FORM_CONSONANT.test(base) ? [base, base + (base.at(-1) as string)] : [base];
    return forms.some((form) => WORD_FORM_SUFFIXES.some((suffix) => word === form + suffix));
}

function isWordForm(word: string, term: string): boolean {
    const bases = BANNED_WORD_FORMS[term] ?? [term];
    return bases.some((base) => isInflectedForm(word, base));
}

function hasTerm(words: string[], term: BannedWord): boolean {
    const lastStart = term.firstWord === true ? 0 : words.length - term.words.length;
    for (let start = 0; start <= lastStart && start + term.words.length <= words.length; start += 1) {
        if (term.words.every((termWord, index) => isWordForm(words[start + index] as string, termWord))) return true;
    }
    return false;
}

function stripPrefixes(name: string, overrides: CompiledOverride[]): string {
    let result = name;
    for (const override of overrides)
        if (override.ignoredPrefix !== undefined) result = result.replace(override.ignoredPrefix, '');
    return result === '' ? name : result;
}

function validateCase(checked: CheckedIdentifier, name: string, limits: CategoryLimits) {
    if (limits.cases.length === 0) return undefined;
    const isFileName = checked.identifier.category === 'files';
    const isMatched = limits.cases.some((caseName) => {
        if (caseName === 'timestamp-snake') return CASE_TESTS[caseName](name);
        const subject = isFileName ? name.replace(LAST_EXTENSION, '') : name;
        return [subject, checked.identifier.name].some((text) =>
            text.split('.').every((segment) => CASE_TESTS[caseName](segment)),
        );
    });
    return isMatched
        ? undefined
        : {
              ...checked.place,
              rule: RULES.case,
              message: `${checked.prefix}expected ${formatNameList(limits.cases, 'disjunction')} case.`,
          };
}

function validateDigits(checked: CheckedIdentifier, words: string[], overrides: CompiledOverride[]) {
    if (
        words.every((segment) => !DIGIT.test(segment) || NUMERIC_WORDS.has(segment)) ||
        overrides.some((override) => override.digitsAllowed)
    )
        return undefined;
    return {
        ...checked.place,
        rule: RULES.digits,
        message: `${checked.prefix}a digit is not a word.`,
    };
}

function validateLength(checked: CheckedIdentifier, name: string, limits: CategoryLimits) {
    if (limits.maxCharacters <= 0 || name.length <= limits.maxCharacters) return undefined;
    return {
        ...checked.place,
        rule: RULES.length,
        message: `${checked.prefix}${String(name.length)} characters is over the limit of ${String(limits.maxCharacters)}.`,
    };
}

function validateWordCount(checked: CheckedIdentifier, words: string[], limits: CategoryLimits) {
    if (limits.maxWords <= 0 || words.length <= limits.maxWords) return undefined;
    return {
        ...checked.place,
        rule: RULES.words,
        message: `${checked.prefix}${String(words.length)} words is over the limit of ${String(limits.maxWords)}.`,
    };
}

function validateRepeatedWords(checked: CheckedIdentifier, words: string[], overrides: CompiledOverride[]) {
    if (overrides.some((override) => override.repeatedWordsAllowed)) return undefined;
    const repeated = findRepeatedWord(words);
    return repeated === undefined
        ? undefined
        : {
              ...checked.place,
              rule: RULES.duplicateWords,
              message: `${checked.prefix}"${repeated}" repeats.`,
          };
}

function isPhraseAt(words: string[], index: number, phrase: string[]): boolean {
    const end = index + phrase.length;
    return (
        end <= words.length &&
        phrase.every((word, offset) =>
            offset === phrase.length - 1
                ? isWordForm(words[index + offset] as string, word)
                : words[index + offset] === word,
        )
    );
}

function removePhrase(words: string[], phrase: string[]): string[] {
    const remaining: string[] = [];
    let index = 0;
    while (index < words.length) {
        if (isPhraseAt(words, index, phrase)) index += phrase.length;
        else {
            remaining.push(words[index] as string);
            index += 1;
        }
    }
    return remaining;
}

function removeAllowedPhrases(sourceWords: string[], phrases: string[][]): string[] {
    let words = sourceWords;
    for (const phrase of phrases) words = removePhrase(words, phrase);
    return words;
}

function validateBannedWords(checked: CheckedIdentifier, nameWords: string[]): CheckFinding | undefined {
    const { settings } = checked;
    const terms = checked.isTestFile
        ? settings.bannedWords.filter((term) => term.list !== TEST_WORD_LIST)
        : settings.bannedWords;
    const words = removeAllowedPhrases(nameWords, settings.allowedPhrases);
    const banned = terms.find(
        (term) =>
            (term.categories === undefined || term.categories.includes(checked.identifier.category)) &&
            hasTerm(words, term),
    );
    return banned === undefined
        ? undefined
        : {
              ...checked.place,
              rule: RULES.bannedWord,
              message: `${checked.prefix}"${banned.word}" is banned (${banned.setting}).`,
          };
}

function findRepeatedWord(words: string[]): string | undefined {
    const seen = new Set<string>();
    for (const segment of words) {
        if (seen.has(segment)) return segment;
        seen.add(segment);
    }
    return undefined;
}

function selectOverrides(settings: NamingSettings, identifier: Identifier): CompiledOverride[] {
    const path = identifier.folder ?? identifier.file;
    return settings.overrides.filter(
        (override) =>
            override.matches(path) &&
            (override.languages === undefined || override.languages.has(identifier.language)) &&
            (override.categories === undefined || override.categories.has(identifier.category)),
    );
}

function buildIdentifierLimits(
    settings: NamingSettings,
    identifier: Identifier,
    overrides: CompiledOverride[],
): CategoryLimits {
    const base = settings.limitLookup(identifier.language, identifier.category);
    if (identifier.language === 'python' && RUFF_CATEGORIES.has(identifier.category)) return { ...base, cases: [] };
    const caseOverride = overrides.findLast((override) => override.cases !== undefined);
    return identifier.language === 'swift' && SWIFTLINT_CATEGORIES.has(identifier.category)
        ? { ...base, cases: [], maxCharacters: 0 }
        : { ...base, cases: [...(caseOverride?.cases ?? base.cases), ...(identifier.addedCases ?? [])] };
}

function validateIdentifier(identifier: Identifier, naming: FileNaming): CheckFinding[] {
    const context: CheckedIdentifier = {
        ...naming,
        identifier,
        place: { file: identifier.file, line: identifier.line, column: identifier.column },
        prefix: `${identifier.label} "${identifier.name}": `,
    };
    const { settings } = naming;
    const overrides = selectOverrides(settings, identifier);
    if (
        overrides.some(
            (override) =>
                override.allowedNames?.has(identifier.name) === true ||
                override.ignoredNames?.test(identifier.name) === true,
        )
    )
        return [];
    const limits = buildIdentifierLimits(settings, identifier, overrides);
    const name = stripPrefixes(identifier.name, overrides);
    const nameWords = splitWords(name);
    const words = splitWords(name.split('.', 1)[0] ?? name).filter((segment) => !DIGITS_ONLY.test(segment));
    const findings = [
        validateCase(context, name, limits),
        validateDigits(context, nameWords, overrides),
        validateLength(context, name, limits),
        validateWordCount(context, words, limits),
        validateRepeatedWords(context, words, overrides),
        validateBannedWords(context, nameWords),
    ];
    return findings.filter((finding) => finding !== undefined);
}

/**
Check declared names against naming rules and the selected test-file patterns.

@param planned the selected check and its test-file patterns.
@param settings the naming limits and allowances.
@param identifiers the declarations and their source positions.
*/
export function validateIdentifiers(
    planned: NamingCheck,
    settings: NamingSettings,
    identifiers: Identifier[],
): CheckFinding[] {
    const isTestFile = buildPathMatcher(planned.scope.settings.test_files);
    return identifiers.flatMap((identifier) =>
        validateIdentifier(identifier, {
            settings,
            isTestFile: isTestFile(identifier.file),
        }),
    );
}

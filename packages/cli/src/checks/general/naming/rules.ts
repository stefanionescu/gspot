import { DIGITS_ONLY } from '#cli/config/text.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { SQL_EXTENSION } from '#cli/config/files/names.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findParentCategory } from '#cli/settings/naming.ts';
import type { NamingCase } from '#cli/types/settings/naming.ts';
import { splitWords } from '#cli/checks/general/naming/settings.ts';
import { NUMERIC_WORDS } from '#cli/config/checks/general/naming/settings.ts';

import type {
    Identifier,
    FileNaming,
    CategoryLimits,
    NamingSettings,
    CompiledOverride,
    CheckedIdentifier,
} from '#cli/types/checks/general/naming.ts';
import {
    DIGIT,
    DIGIT_RUNS,
    UPPER_WORD,
    CAMEL_WORD,
    LOWER_WORD,
    PASCAL_WORD,
    VOWEL_SUFFIX,
    LAST_EXTENSION,
    RUFF_CATEGORIES,
    TEST_TERM_GROUP,
    MIGRATION_DIGITS,
    SWIFTLINT_PARENTS,
    BANNED_WORD_FORMS,
    WORD_FORM_SUFFIXES,
    WORD_FORM_CONSONANT,
} from '#cli/config/checks/general/naming/rules.ts';

function isSnakeMigration(name: string): boolean {
    const stamp = name.slice(0, MIGRATION_DIGITS);
    const rest = name.slice(MIGRATION_DIGITS);
    if (!DIGITS_ONLY.test(stamp) || !rest.startsWith('_') || !rest.endsWith(SQL_EXTENSION)) return false;
    const stem = rest.slice(1, -SQL_EXTENSION.length);
    return stem !== '' && stem.split('_').every((word) => LOWER_WORD.test(word));
}

const CASE_TESTS = {
    camel: (name) => CAMEL_WORD.test(name),
    pascal: (name) => PASCAL_WORD.test(name),
    'pascal-extension': (name) => name.includes('+') && name.split('+').every((word) => PASCAL_WORD.test(word)),
    kebab: (name) => name !== '' && name.split('-').every((word) => LOWER_WORD.test(word)),
    snake: (name) => name !== '' && name.split('_').every((word) => LOWER_WORD.test(word)),
    'upper-snake': (name) => name !== '' && name.split('_').every((word) => UPPER_WORD.test(word)),
    'timestamp-snake': isSnakeMigration,
} satisfies Record<NamingCase, (name: string) => boolean>;

function isWordForm(word: string, term: string): boolean {
    return (BANNED_WORD_FORMS[term] ?? [term]).some((base) => {
        if (word === base) return true;
        const forms = [base];
        if (
            base.endsWith('e') &&
            WORD_FORM_SUFFIXES.some((suffix) => VOWEL_SUFFIX.test(suffix) && word === base.slice(0, -1) + suffix)
        )
            return true;
        if (base.endsWith('y') && ['ies', 'ied'].some((suffix) => word === base.slice(0, -1) + suffix)) return true;
        if (WORD_FORM_CONSONANT.test(base)) forms.push(base + (base.at(-1) as string));
        return forms.some((form) => WORD_FORM_SUFFIXES.some((suffix) => word === form + suffix));
    });
}

function hasTerm(words: string[], termWords: string[]): boolean {
    for (let start = 0; start + termWords.length <= words.length; start += 1) {
        if (termWords.every((termWord, index) => isWordForm(words[start + index] as string, termWord))) return true;
    }
    return false;
}

function stripPrefixes(name: string, overrides: CompiledOverride[]): string {
    let result = name;
    for (const override of overrides)
        if (override.ignoredPrefix !== undefined) result = result.replace(override.ignoredPrefix, '');
    return result === '' ? name : result;
}

function checkCase(checked: CheckedIdentifier, name: string, limits: CategoryLimits) {
    if (limits.caseNames.length === 0) return undefined;
    const isFileName = checked.identifier.category === 'files';
    const digitless = name.replaceAll(DIGIT_RUNS, '');
    const isMatched = limits.caseNames.some((caseName) => {
        if (caseName === 'timestamp-snake') return CASE_TESTS[caseName](name);
        const subject = isFileName ? digitless.replace(LAST_EXTENSION, '') : digitless;
        return [subject, checked.identifier.name.replaceAll(DIGIT_RUNS, '')].some((text) =>
            text.split('.').every((segment) => CASE_TESTS[caseName](segment)),
        );
    });
    return isMatched
        ? undefined
        : buildFinding(
              checked,
              checked.place,
              'case',
              `${checked.prefix}expected ${limits.caseNames.join(' or ')} case.`,
          );
}

function checkDigits(checked: CheckedIdentifier, words: string[], overrides: CompiledOverride[]) {
    if (
        !words.some((segment) => DIGIT.test(segment) && !NUMERIC_WORDS.has(segment)) ||
        overrides.some((override) => override.isDigitsAllowed)
    )
        return undefined;
    return buildFinding(checked, checked.place, 'digits', `${checked.prefix}a digit is not a word.`);
}

function checkLength(checked: CheckedIdentifier, name: string, limits: CategoryLimits) {
    if (limits.maxChars <= 0 || name.length <= limits.maxChars) return undefined;
    return buildFinding(
        checked,
        checked.place,
        'length',
        `${checked.prefix}${String(name.length)} characters is over the limit of ${String(limits.maxChars)}.`,
    );
}

function checkWordCount(checked: CheckedIdentifier, words: string[], limits: CategoryLimits) {
    if (limits.maxWords <= 0 || words.length <= limits.maxWords) return undefined;
    return buildFinding(
        checked,
        checked.place,
        'words',
        `${checked.prefix}${String(words.length)} words is over the limit of ${String(limits.maxWords)}.`,
    );
}

function checkRepeatedWords(checked: CheckedIdentifier, words: string[], overrides: CompiledOverride[]) {
    if (overrides.some((override) => override.isRepeatAllowed)) return undefined;
    const repeated = findRepeatedWord(words);
    return repeated === undefined
        ? undefined
        : buildFinding(checked, checked.place, 'duplicate-words', `${checked.prefix}"${repeated}" repeats.`);
}

function removeAllowedPhrases(sourceWords: string[], phrases: string[][]): string[] {
    let words = sourceWords;
    for (const phrase of phrases) {
        const remaining: string[] = [];
        for (let index = 0; index < words.length; ) {
            if (
                index + phrase.length <= words.length &&
                phrase.every((word, offset) =>
                    offset === phrase.length - 1
                        ? isWordForm(words[index + offset] as string, word)
                        : words[index + offset] === word,
                )
            )
                index += phrase.length;
            else {
                remaining.push(words[index] as string);
                index += 1;
            }
        }
        words = remaining;
    }
    return words;
}

function checkBannedWords(checked: CheckedIdentifier, nameWords: string[]): Finding | undefined {
    const { settings } = checked;
    const terms = checked.isTestFile
        ? settings.bannedWords.filter((term) => term.group !== TEST_TERM_GROUP)
        : settings.bannedWords;
    const words = removeAllowedPhrases(nameWords, settings.allowedPhrases);
    const banned = terms.find(
        (term) =>
            (term.categories === undefined || term.categories.includes(checked.identifier.category)) &&
            hasTerm(words, term.words),
    );
    return banned === undefined
        ? undefined
        : buildFinding(
              checked,
              checked.place,
              'banned-word',
              `${checked.prefix}"${banned.word}" is banned (${banned.setting}).`,
          );
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
    const base = settings.limitsFor(identifier.language, identifier.category);
    const parent = findParentCategory(identifier.category);
    if (identifier.language === 'python' && RUFF_CATEGORIES.has(identifier.category)) return { ...base, caseNames: [] };
    const caseOverride = overrides.findLast((override) => override.cases !== undefined);
    return identifier.language === 'swift' && SWIFTLINT_PARENTS.has(parent)
        ? { ...base, caseNames: [], maxChars: 0 }
        : { ...base, caseNames: [...(caseOverride?.cases ?? base.caseNames), ...(identifier.addedCases ?? [])] };
}

/**
Checks an identifier against the naming settings, unless a path override allows it.

@param identifier the name to check.
@param naming the check and its naming settings.
@returns the findings, empty when the name passes.
*/
export function validateIdentifier(identifier: Identifier, naming: FileNaming): Finding[] {
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
        checkCase(context, name, limits),
        checkDigits(context, nameWords, overrides),
        checkLength(context, name, limits),
        checkWordCount(context, words, limits),
        checkRepeatedWords(context, words, overrides),
        checkBannedWords(context, nameWords),
    ];
    return findings.filter((finding) => finding !== undefined);
}

/**
Check declared names against naming rules and the selected test-file patterns.

@param planned the selected check and its test-file patterns.
@param settings the naming limits and allowances.
@param identifiers the declarations and their source positions.
@returns the naming findings for the supplied declarations.
*/
export function validateIdentifiers(
    planned: PlannedCheck,
    settings: NamingSettings,
    identifiers: Identifier[],
): Finding[] {
    const isTestFile = buildPathMatcher(planned.scope.settings.test_files);
    return identifiers.flatMap((identifier) =>
        validateIdentifier(identifier, {
            check: planned.check,
            settings,
            isTestFile: isTestFile(identifier.file),
        }),
    );
}

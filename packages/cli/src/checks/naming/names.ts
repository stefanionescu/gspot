import { buildFinding } from '#cli/runs/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { splitParts } from '#cli/checks/naming/settings.ts';
import type { NamingCase } from '#cli/types/settings/tables.ts';
import { SQL_EXTENSION } from '#cli/config/repository/inventory.ts';

import type {
    Identifier,
    NamingInputs,
    NamingContext,
    CategoryLimits,
    NamingSettings,
    CompiledOverride,
} from '#cli/types/checks/general.ts';
import {
    DIGIT,
    DIGIT_RUNS,
    CAMEL_WORD,
    LOWER_WORD,
    UPPER_WORD,
    DIGITS_ONLY,
    PASCAL_WORD,
    NUMERIC_WORDS,
    LAST_EXTENSION,
    TEST_TERM_GROUP,
    RUFF_CATEGORIES,
    VERB_CATEGORIES,
    CATEGORY_PARENTS,
    MIGRATION_DIGITS,
    BANNED_WORD_FORMS,
    SWIFTLINT_PARENTS,
    WORD_FORM_SUFFIXES,
    WORD_FORM_CONSONANT,
} from '#cli/config/checks/general/naming.ts';

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

function isWordForm(word: string, stem: string): boolean {
    return (BANNED_WORD_FORMS[stem] ?? [stem]).some((base) => {
        if (word === base) return true;
        const forms = [base];
        if (base.endsWith('e')) forms.push(base.slice(0, -1));
        if (base.endsWith('y') && ['ies', 'ied'].some((suffix) => word === base.slice(0, -1) + suffix)) return true;
        if (WORD_FORM_CONSONANT.test(base)) forms.push(base + (base.at(-1) as string));
        return forms.some((form) => WORD_FORM_SUFFIXES.some((suffix) => word === form + suffix));
    });
}

function isConsecutive(parts: string[], termParts: string[]): boolean {
    for (let start = 0; start + termParts.length <= parts.length; start += 1) {
        if (termParts.every((part, index) => isWordForm(parts[start + index] as string, part))) return true;
    }
    return false;
}

function stripPrefixes(name: string, overrides: CompiledOverride[]): string {
    let result = name;
    for (const override of overrides)
        if (override.ignoredPrefix !== undefined) result = result.replace(override.ignoredPrefix, '');
    return result === '' ? name : result;
}

function checkCase(context: NamingContext, name: string, limits: CategoryLimits) {
    if (limits.caseNames.length === 0) return undefined;
    const isFileName = context.identifier.category === 'files';
    const digitless = name.replaceAll(DIGIT_RUNS, '');
    const isMatched = limits.caseNames.some((caseName) => {
        if (caseName === 'timestamp-snake') return CASE_TESTS[caseName](name);
        const subject = isFileName ? digitless.replace(LAST_EXTENSION, '') : digitless;
        return [subject, context.identifier.name.replaceAll(DIGIT_RUNS, '')].some((candidate) =>
            candidate.split('.').every((segment) => CASE_TESTS[caseName](segment)),
        );
    });
    return isMatched
        ? undefined
        : buildFinding(
              context,
              context.place,
              'case',
              `${context.prefix}expected ${limits.caseNames.join(' or ')} case.`,
          );
}

function checkDigits(context: NamingContext, parts: string[], overrides: CompiledOverride[]) {
    const { settings } = context;
    if (
        settings.isDigitsAllowed ||
        !parts.some((part) => DIGIT.test(part) && !NUMERIC_WORDS.has(part)) ||
        overrides.some((override) => override.isDigitsAllowed)
    )
        return undefined;
    return buildFinding(context, context.place, 'digits', `${context.prefix}a digit is not a word.`);
}

function checkLength(context: NamingContext, name: string, limits: CategoryLimits) {
    if (limits.maxChars <= 0 || name.length <= limits.maxChars) return undefined;
    return buildFinding(
        context,
        context.place,
        'length',
        `${context.prefix}${String(name.length)} characters is over the limit of ${String(limits.maxChars)}.`,
    );
}

function checkWordCount(context: NamingContext, words: string[], limits: CategoryLimits) {
    if (limits.maxWords <= 0 || words.length <= limits.maxWords) return undefined;
    return buildFinding(
        context,
        context.place,
        'words',
        `${context.prefix}${String(words.length)} words is over the limit of ${String(limits.maxWords)}.`,
    );
}

function checkRepeatedWords(context: NamingContext, words: string[], overrides: CompiledOverride[]) {
    const { settings } = context;
    if (settings.isRepeatAllowed || overrides.some((override) => override.isRepeatAllowed)) return undefined;
    const repeated = findRepeatedPart(words);
    return repeated === undefined
        ? undefined
        : buildFinding(context, context.place, 'duplicate-words', `${context.prefix}"${repeated}" repeats.`);
}

function removeAllowedPhrases(parts: string[], phrases: string[][]): string[] {
    let words = parts;
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

function checkBannedWords(context: NamingContext, parts: string[]): Finding[] {
    const { settings } = context;
    const findings: Finding[] = [];
    const terms = context.isTestFile
        ? settings.bannedWords.filter((term) => term.group !== TEST_TERM_GROUP)
        : settings.bannedWords;
    const words = removeAllowedPhrases(parts, settings.allowedPhrases);
    const banned = terms.find(
        (term) =>
            (term.categories === undefined || term.categories.includes(context.identifier.category)) &&
            isConsecutive(words, term.parts),
    );
    if (banned !== undefined)
        findings.push(
            buildFinding(
                context,
                context.place,
                'banned-word',
                `${context.prefix}"${banned.word}" is banned (${banned.setting}).`,
            ),
        );
    for (const [term, allowedFor] of settings.reserved) {
        if (!parts.includes(term) || allowedFor.includes(context.identifier.category)) continue;
        findings.push(
            buildFinding(
                context,
                context.place,
                'reserved-term',
                `${context.prefix}"${term}" is reserved for ${allowedFor.join(', ')}; this is a ${context.identifier.label}.`,
            ),
        );
    }
    return findings;
}

function checkCallbackVerb(context: NamingContext, parts: string[]) {
    if (!VERB_CATEGORIES.has(context.identifier.category)) return undefined;
    const verb = context.settings.overrides
        .filter(
            (override) =>
                override.matches(context.identifier.file) &&
                (override.languages === undefined || override.languages.has(context.identifier.language)),
        )
        .map((override) => override.ignoredPrefix?.exec(context.identifier.name)?.[0])
        .find((prefix) => prefix === parts[0]);
    return verb === undefined
        ? undefined
        : buildFinding(
              context,
              context.place,
              'callback-verb',
              `${context.prefix}"${verb}" starts a name only for event handlers. Name what this function does.`,
          );
}

/**
 * Finds the first part that appears twice.
 * @param parts ordered words and digit groups from one declared name.
 * @returns the repeated part, or undefined.
 */
function findRepeatedPart(parts: string[]): string | undefined {
    const seen = new Set<string>();
    for (const part of parts) {
        if (seen.has(part)) return part;
        seen.add(part);
    }
    return undefined;
}

/**
 * Selects the path overrides that apply to an identifier.
 * @param settings what the scope allows and bans.
 * @param identifier the name to match.
 * @returns the overrides, in settings order.
 */
function selectOverrides(settings: NamingSettings, identifier: Identifier): CompiledOverride[] {
    const path = identifier.folder ?? identifier.file;
    return settings.overrides.filter(
        (override) =>
            override.matches(path) &&
            (override.languages === undefined || override.languages.has(identifier.language)) &&
            (override.categories === undefined || override.categories.has(identifier.category)),
    );
}

/**
 * Computes the limits and cases for an identifier after its path overrides.
 * @param settings what the scope allows and bans.
 * @param identifier the name to check.
 * @param overrides the matching `[[naming.override]]` records.
 * @returns the length limits and allowed cases.
 */
function deriveLimits(settings: NamingSettings, identifier: Identifier, overrides: CompiledOverride[]): CategoryLimits {
    const base = settings.limitsFor(identifier.language, identifier.category);
    const parents: Readonly<Record<string, string>> = CATEGORY_PARENTS;
    const parent = parents[identifier.category] ?? identifier.category;
    // Ruff checks Python class and exception names and SwiftLint checks Swift type and variable names,
    // so gspot checks neither their case nor their length.
    if (
        (identifier.language === 'swift' && SWIFTLINT_PARENTS.has(parent)) ||
        (identifier.language === 'python' && RUFF_CATEGORIES.has(identifier.category))
    )
        return { ...base, caseNames: [], maxChars: 0 };
    const caseOverride = overrides.findLast((override) => override.cases !== undefined);
    return caseOverride?.cases === undefined ? base : { ...base, caseNames: caseOverride.cases };
}

/**
 * Checks an identifier against the naming settings, unless a path override allows it.
 * @param identifier the name to check.
 * @param inputs the check and its naming settings.
 * @returns the findings, empty when the name passes.
 */
export function checkIdentifier(identifier: Identifier, inputs: NamingInputs): Finding[] {
    const context: NamingContext = {
        ...inputs,
        identifier,
        place: { file: identifier.file, line: identifier.line, column: identifier.column },
        prefix: `${identifier.label} "${identifier.name}": `,
    };
    const { settings } = inputs;
    const overrides = selectOverrides(settings, identifier);
    if (overrides.some((override) => override.allowedNames?.has(identifier.name) === true)) return [];
    const limits = deriveLimits(settings, identifier, overrides);
    const name = stripPrefixes(identifier.name, overrides);
    const parts = splitParts(name);
    const words = splitParts(name.split('.', 1)[0] ?? name).filter((part) => !DIGITS_ONLY.test(part));
    const findings = [
        checkCase(context, name, limits),
        checkDigits(context, parts, overrides),
        checkLength(context, name, limits),
        checkWordCount(context, words, limits),
        checkRepeatedWords(context, words, overrides),
        ...checkBannedWords(context, parts),
        checkCallbackVerb(context, parts),
    ];
    return findings.filter((finding) => finding !== undefined);
}

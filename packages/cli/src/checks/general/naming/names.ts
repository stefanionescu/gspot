import { findingAt } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/execution/check.ts';
import { splitParts } from '#cli/checks/general/naming/settings.ts';
import { SQL_EXTENSION } from '#cli/config/repository/inventory.ts';

import type {
    CaseName,
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
    SWIFTLINT_PARENTS,
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
} satisfies Record<CaseName, (name: string) => boolean>;

function isConsecutive(parts: string[], termParts: string[]): boolean {
    for (let start = 0; start + termParts.length <= parts.length; start += 1) {
        if (termParts.every((part, index) => parts[start + index] === part)) return true;
    }
    return false;
}

function stripped(name: string, rules: CompiledOverride[]): string {
    let result = name;
    for (const rule of rules)
        if (rule.structuralPrefix !== undefined) result = result.replace(rule.structuralPrefix, '');
    return result === '' ? name : result;
}

function caseFinding(context: NamingContext, name: string, limits: CategoryLimits) {
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
        : findingAt(context, context.place, 'case', `${context.prefix}expected ${limits.caseNames.join(' or ')} case.`);
}

function digitFinding(context: NamingContext, parts: string[], rules: CompiledOverride[]) {
    const { settings } = context;
    if (
        settings.isDigitsAllowed ||
        !parts.some((part) => DIGIT.test(part) && !NUMERIC_WORDS.has(part)) ||
        rules.some((rule) => rule.isDigitsAllowed)
    )
        return undefined;
    return findingAt(context, context.place, 'digits', `${context.prefix}a digit is not a word.`);
}

function lengthFinding(context: NamingContext, name: string, limits: CategoryLimits) {
    if (limits.maxChars <= 0 || name.length <= limits.maxChars) return undefined;
    return findingAt(
        context,
        context.place,
        'length',
        `${context.prefix}${String(name.length)} characters is over the limit of ${String(limits.maxChars)}.`,
    );
}

function wordsFinding(context: NamingContext, words: string[], limits: CategoryLimits) {
    if (limits.maxWords <= 0 || words.length <= limits.maxWords) return undefined;
    return findingAt(
        context,
        context.place,
        'words',
        `${context.prefix}${String(words.length)} words is over the limit of ${String(limits.maxWords)}.`,
    );
}

function repeatFinding(context: NamingContext, words: string[], rules: CompiledOverride[]) {
    const { settings } = context;
    if (settings.isRepeatAllowed || rules.some((rule) => rule.isRepeatAllowed)) return undefined;
    const repeated = repeatedPart(words);
    return repeated === undefined
        ? undefined
        : findingAt(context, context.place, 'duplicate-words', `${context.prefix}"${repeated}" repeats.`);
}

function termFindings(context: NamingContext, parts: string[]): Finding[] {
    const { settings } = context;
    const findings: Finding[] = [];
    const terms = context.isTestFile ? settings.terms.filter((term) => term.group !== TEST_TERM_GROUP) : settings.terms;
    const banned = terms.find(
        (term) =>
            (term.categories === undefined || term.categories.includes(context.identifier.category)) &&
            isConsecutive(parts, term.parts),
    );
    if (banned !== undefined)
        findings.push(
            findingAt(
                context,
                context.place,
                'banned-term',
                `${context.prefix}"${banned.term}" is banned (${banned.source}).`,
            ),
        );
    for (const [term, allowedFor] of settings.reserved) {
        if (!parts.includes(term) || allowedFor.includes(context.identifier.category)) continue;
        findings.push(
            findingAt(
                context,
                context.place,
                'reserved-term',
                `${context.prefix}"${term}" is reserved for ${allowedFor.join(', ')}; this is a ${context.identifier.label}.`,
            ),
        );
    }
    return findings;
}

function callbackFinding(context: NamingContext, parts: string[]) {
    if (!VERB_CATEGORIES.has(context.identifier.category)) return undefined;
    const verb = context.settings.rules
        .filter(
            (rule) =>
                rule.matches(context.identifier.file) &&
                (rule.languages === undefined || rule.languages.has(context.identifier.language)),
        )
        .map((rule) => rule.structuralPrefix?.exec(context.identifier.name)?.[0])
        .find((prefix) => prefix === parts[0]);
    return verb === undefined
        ? undefined
        : findingAt(
              context,
              context.place,
              'callback-verb',
              `${context.prefix}"${verb}" starts a name only for event handlers. Name what this function does.`,
          );
}

/**
 * The first part that appears twice, if any.
 * @param parts the parts.
 * @returns the repeated part.
 */
function repeatedPart(parts: string[]): string | undefined {
    const seen = new Set<string>();
    for (const part of parts) {
        if (seen.has(part)) return part;
        seen.add(part);
    }
    return undefined;
}

/**
 * The path rules that apply to one identifier.
 * @param settings the effective settings.
 * @param identifier the identifier.
 * @returns the rules, in settings order.
 */
function overridesFor(settings: NamingSettings, identifier: Identifier): CompiledOverride[] {
    const path = identifier.directory ?? identifier.file;
    return settings.rules.filter(
        (rule) =>
            rule.matches(path) &&
            (rule.languages === undefined || rule.languages.has(identifier.language)) &&
            (rule.categories === undefined || rule.categories.has(identifier.category)),
    );
}

/**
 * The limits and cases for one identifier after its path rules.
 * @param settings the effective settings.
 * @param identifier the identifier.
 * @param rules the rules that apply.
 * @returns the limits.
 */
function ruleLimits(settings: NamingSettings, identifier: Identifier, rules: CompiledOverride[]): CategoryLimits {
    const base = settings.limitsFor(identifier.language, identifier.category);
    const parents: Readonly<Record<string, string>> = CATEGORY_PARENTS;
    const parent = parents[identifier.category] ?? identifier.category;
    // Ruff checks Python class and exception names and SwiftLint checks Swift type and variable names,
    // so gspot checks neither their case nor their length.
    if (
        (identifier.language === 'swift' && new Set<string | undefined>(SWIFTLINT_PARENTS).has(parent)) ||
        (identifier.language === 'python' && new Set<string | undefined>(RUFF_CATEGORIES).has(identifier.category))
    )
        return { ...base, caseNames: [], maxChars: 0 };
    const caseRule = rules.findLast((rule) => rule.caseNames !== undefined);
    return caseRule?.caseNames === undefined ? base : { ...base, caseNames: caseRule.caseNames };
}

/**
 * Findings for one identifier under the settings. A path rule can exclude the identifier.
 * @param identifier the identifier.
 * @param inputs the check identity, effective settings, and the file's test status.
 * @returns the findings, empty when the name passes.
 */
export function nameFindings(identifier: Identifier, inputs: NamingInputs): Finding[] {
    const context: NamingContext = {
        ...inputs,
        identifier,
        place: { file: identifier.file, line: identifier.line, column: identifier.column },
        prefix: `${identifier.label} "${identifier.name}": `,
    };
    const { settings } = inputs;
    const rules = overridesFor(settings, identifier);
    if (rules.some((rule) => rule.allowed?.has(identifier.name) === true)) return [];
    const limits = ruleLimits(settings, identifier, rules);
    const name = stripped(identifier.name, rules);
    const parts = splitParts(name);
    const words = splitParts(name.split('.', 1)[0] ?? name).filter((part) => !DIGITS_ONLY.test(part));
    const findings = [
        caseFinding(context, name, limits),
        digitFinding(context, parts, rules),
        lengthFinding(context, name, limits),
        wordsFinding(context, words, limits),
        repeatFinding(context, words, rules),
        ...termFindings(context, parts),
        callbackFinding(context, parts),
    ];
    return findings.filter((finding) => finding !== undefined);
}

import { splitByCase } from 'scule';
import { findingAt } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { Identifier } from '#cli/types/parsers/naming.ts';

import type {
    Term,
    PathRule,
    NamingInputs,
    NamingContext,
    CategoryLimits,
    EffectivePolicy,
} from '#cli/types/checks/general/naming.ts';
import {
    DIGIT,
    TIMESTAMP,
    CAMEL_WORD,
    LOWER_WORD,
    SEPARATORS,
    UPPER_WORD,
    NUMBER_PART,
    PASCAL_WORD,
    NUMERIC_WORDS,
    VERB_CATEGORIES,
    CATEGORY_PARENTS,
    MIGRATION_DIGITS,
} from '#cli/config/checks/general/naming.ts';

function isSnakeMigration(name: string): boolean {
    const stamp = name.slice(0, MIGRATION_DIGITS);
    const rest = name.slice(MIGRATION_DIGITS);
    if (!TIMESTAMP.test(stamp) || !rest.startsWith('_') || !rest.endsWith('.sql')) return false;
    const stem = rest.slice(1, -'.sql'.length);
    return stem !== '' && stem.split('_').every((word) => LOWER_WORD.test(word));
}

const CASE_TESTS = new Map<string, (name: string) => boolean>([
    ['camel', (name) => CAMEL_WORD.test(name)],
    ['pascal', (name) => PASCAL_WORD.test(name)],
    ['pascal-extension', (name) => name.includes('+') && name.split('+').every((word) => PASCAL_WORD.test(word))],
    ['kebab', (name) => name !== '' && name.split('-').every((word) => LOWER_WORD.test(word))],
    ['snake', (name) => name !== '' && name.split('_').every((word) => LOWER_WORD.test(word))],
    ['upper-snake', (name) => name !== '' && name.split('_').every((word) => UPPER_WORD.test(word))],
    ['timestamp-snake', isSnakeMigration],
]);

function isConsecutive(parts: string[], termParts: string[]): boolean {
    for (let start = 0; start + termParts.length <= parts.length; start += 1) {
        if (termParts.every((part, index) => parts[start + index] === part)) return true;
    }
    return false;
}

function stripped(name: string, rules: PathRule[]): string {
    let result = name;
    for (const rule of rules)
        if (rule.structuralPrefix !== undefined) result = result.replace(rule.structuralPrefix, '');
    return result === '' ? name : result;
}

function caseFinding(context: NamingContext, name: string, limits: CategoryLimits) {
    if (limits.caseNames.length === 0) return undefined;
    const isFileName = context.identifier.category === 'files';
    const digitless = name.replaceAll(/\d+/gu, '');
    const isMatched = limits.caseNames.some((caseName) => {
        if (caseName === 'timestamp-snake') return hasCase(name, caseName);
        const subject = isFileName ? digitless.replace(/\.[^.]*$/u, '') : digitless;
        return [subject, context.identifier.name.replaceAll(/\d+/gu, '')].some((candidate) =>
            candidate.split('.').every((segment) => hasCase(segment, caseName)),
        );
    });
    return isMatched
        ? undefined
        : findingAt(context, context.place, 'case', `${context.prefix}expected ${limits.caseNames.join(' or ')} case.`);
}

function digitFinding(context: NamingContext, parts: string[], rules: PathRule[]) {
    const { policy } = context;
    if (
        policy.isDigitsAllowed ||
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
        `${context.prefix}${String(name.length)} characters is over the ceiling of ${String(limits.maxChars)}.`,
    );
}

function wordsFinding(context: NamingContext, words: string[], limits: CategoryLimits) {
    if (limits.maxWords <= 0 || words.length <= limits.maxWords) return undefined;
    return findingAt(
        context,
        context.place,
        'words',
        `${context.prefix}${String(words.length)} words is over the ceiling of ${String(limits.maxWords)}.`,
    );
}

function repeatFinding(context: NamingContext, words: string[], rules: PathRule[]) {
    const { policy } = context;
    if (policy.isRepeatAllowed || rules.some((rule) => rule.isRepeatAllowed)) return undefined;
    const repeated = repeatedPart(words);
    return repeated === undefined
        ? undefined
        : findingAt(context, context.place, 'duplicate-words', `${context.prefix}"${repeated}" repeats.`);
}

function termFindings(context: NamingContext, parts: string[]): Finding[] {
    const { policy } = context;
    const findings: Finding[] = [];
    const terms = context.isTestFile ? policy.terms.filter((term) => term.group !== 'tests') : policy.terms;
    const banned = bannedTerm(parts, terms);
    if (banned !== undefined)
        findings.push(
            findingAt(
                context,
                context.place,
                'banned-term',
                `${context.prefix}"${banned.term}" is banned (${banned.source}).`,
            ),
        );
    for (const [term, allowedFor] of policy.reserved) {
        if (!parts.includes(term) || allowedFor.includes(context.identifier.category)) continue;
        findings.push(
            findingAt(
                context,
                context.place,
                'reserved-term',
                `${context.prefix}"${term}" is reserved for ${allowedFor.join(', ')}; this is a ${context.identifier.kind}.`,
            ),
        );
    }
    return findings;
}

function callbackFinding(context: NamingContext, parts: string[]) {
    if (!VERB_CATEGORIES.has(context.identifier.category)) return undefined;
    const verb = context.policy.rules
        .filter(
            (rule) =>
                rule.matches(context.identifier.file) &&
                (rule.languages === undefined || rule.languages.has(context.identifier.language)) &&
                (rule.names === undefined || rule.names.has(context.identifier.name)),
        )
        .map((rule) => rule.structuralPrefix?.exec(context.identifier.name)?.[0])
        .find((prefix) => prefix === parts[0]);
    return verb === undefined
        ? undefined
        : findingAt(
              context,
              context.place,
              'callback-verb',
              `${context.prefix}"${verb}" leads a name only in a callback position; name what the function does.`,
          );
}

/** The names accepted by case validation, in their display order. */
export const CASE_NAMES = [...CASE_TESTS.keys()];

/**
 * True when the name has the case.
 * @param name the full migration filename, or an ordinary name with digits removed.
 * @param caseName one of camel, pascal, pascal-extension, kebab, snake, upper-snake, timestamp-snake.
 * @returns whether it matches; an unknown case name never matches.
 */
export function hasCase(name: string, caseName: string): boolean {
    return CASE_TESTS.get(caseName)?.(name) ?? false;
}

/**
 * The parts of an identifier, lowercased. `HTMLParser` gives `html`, `parser`; `user_id` gives `user`, `id`; `v2` gives `v`, `2`; `base64` stays one word.
 * @param name the identifier
 * @returns the parts
 */
export function splitParts(name: string): string[] {
    return name
        .split(SEPARATORS)
        .filter((segment) => segment !== '')
        .flatMap((segment) => splitByCase(segment))
        .flatMap((part) =>
            NUMERIC_WORDS.has(part.toLowerCase()) ? [part] : part.split(/(?<=\D)(?=\d)|(?<=\d)(?=\D)/u),
        )
        .map((part) => part.toLowerCase())
        .filter((part) => part !== '');
}

/**
 * The first part that appears twice, if any.
 * @param parts the parts
 * @returns the repeated part
 */
export function repeatedPart(parts: string[]): string | undefined {
    const seen = new Set<string>();
    for (const part of parts) {
        if (seen.has(part)) return part;
        seen.add(part);
    }
    return undefined;
}

/**
 * The first banned term the parts carry: a one-word term equals a part, a longer one matches consecutive parts.
 * @param parts the identifier's parts
 * @param terms the compiled terms
 * @returns the term, or undefined
 */
export function bannedTerm(parts: string[], terms: Term[]): Term | undefined {
    return terms.find((term) => isConsecutive(parts, term.parts));
}

/**
 * Findings for one identifier under the policy. A path rule can exclude the identifier.
 * @param identifier the identifier
 * @param inputs the check identity, effective policy, and whether the file is a test file
 * @returns the findings, empty when the name passes
 */
export function nameFindings(identifier: Identifier, inputs: NamingInputs): Finding[] {
    const context: NamingContext = {
        ...inputs,
        identifier,
        place: { file: identifier.file, line: identifier.line, column: identifier.column },
        prefix: `${identifier.kind} "${identifier.name}": `,
    };
    const { policy } = inputs;
    if (policy.allowed.has(identifier.name)) return [];
    const rules = rulesFor(policy, identifier);
    if (rules.some((rule) => rule.allowed?.has(identifier.name) === true)) return [];
    const limits = ruleLimits(policy, identifier, rules);
    const name = stripped(identifier.name, rules);
    const parts = splitParts(name);
    const words = splitParts(name.split('.', 1)[0] ?? name).filter((part) => !NUMBER_PART.test(part));
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

/**
 * The path rules that apply to one identifier.
 * @param policy the effective policy
 * @param identifier the identifier
 * @returns the rules, in policy order
 */
export function rulesFor(policy: EffectivePolicy, identifier: Identifier): PathRule[] {
    const path = identifier.directory ?? identifier.file;
    return policy.rules.filter(
        (rule) =>
            rule.matches(path) &&
            (rule.languages === undefined || rule.languages.has(identifier.language)) &&
            (rule.categories === undefined || rule.categories.has(identifier.category)) &&
            (rule.names === undefined || rule.names.has(identifier.name)),
    );
}

/**
 * The ceilings and cases for one identifier after its path rules.
 * @param policy the effective policy
 * @param identifier the identifier
 * @param rules the rules that apply
 * @returns the limits
 */
export function ruleLimits(policy: EffectivePolicy, identifier: Identifier, rules: PathRule[]): CategoryLimits {
    const base = policy.limitsFor(identifier.language, identifier.category);
    const parent = CATEGORY_PARENTS[identifier.category] ?? identifier.category;
    if (
        (identifier.language === 'swift' && ['types', 'variables'].includes(parent)) ||
        (identifier.language === 'python' && ['classes', 'exceptions'].includes(identifier.category))
    )
        return { ...base, caseNames: [], maxChars: 0 };
    const caseRule = rules.findLast((rule) => rule.caseNames !== undefined);
    return caseRule?.caseNames === undefined ? base : { ...base, caseNames: caseRule.caseNames };
}

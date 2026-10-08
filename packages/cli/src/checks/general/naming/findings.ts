import { findingAt } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { Identifier } from '#cli/types/parsers/naming.ts';
import { rulesFor, ruleLimits } from '#cli/checks/general/naming/policy.ts';
import { hasCase, splitParts, repeatedPart } from '#cli/checks/general/naming/words.ts';
import type { Term, PathRule, NamingInputs, NamingContext, CategoryLimits } from '#cli/types/checks/general/naming.ts';

import {
    DIGIT,
    NUMBER_PART,
    CALLBACK_VERB,
    NUMERIC_WORDS,
    VERB_CATEGORIES,
} from '#cli/config/checks/general/naming.ts';

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
        return subject.split('.').every((segment) => hasCase(segment, caseName));
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
    if (context.isReactFile || parts[0] !== CALLBACK_VERB || !VERB_CATEGORIES.has(context.identifier.category))
        return undefined;
    return findingAt(
        context,
        context.place,
        'callback-verb',
        `${context.prefix}"${CALLBACK_VERB}" leads a name only in a framework callback position; name what the function does.`,
    );
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
 * @param inputs the check identity, effective policy, and whether the file is a React file or a test file
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

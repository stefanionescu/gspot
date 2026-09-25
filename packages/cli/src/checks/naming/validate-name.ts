import { hasCase } from '#cli/checks/naming/cases.ts';
import type { Identifier } from '#cli/checks/naming/extract.ts';
import { CALLBACK_VERB } from '#cli/checks/naming/categories.ts';
import { limitsUnderRules, rulesFor } from '#cli/checks/naming/policy.ts';
import { repeatedPart, splitParts, wordsOf } from '#cli/checks/naming/split.ts';
import { bannedTerm, isExempt, isReservedUseAllowed } from '#cli/checks/naming/match.ts';
import type { CategoryLimits, EffectivePolicy, PathRule } from '#cli/checks/naming/policy.ts';

const DIGIT = /\d/u;
const TEST_GROUP = 'test group';
const VERB_CATEGORIES = new Set(['functions', 'methods', 'variables']);

function stripped(name: string, rules: PathRule[]): string {
    let result = name;
    for (const rule of rules)
        if (rule.structuralPrefix !== undefined) result = result.replace(rule.structuralPrefix, '');
    return result === '' ? name : result;
}

function caseProblem(name: string, limits: CategoryLimits, isFileName: boolean): NameProblem | undefined {
    if (limits.caseNames.length === 0) return undefined;
    const digitless = name.replaceAll(/\d+/gu, '');
    const isMatched = limits.caseNames.some((caseName) => {
        if (caseName === 'snake-migration') return hasCase(name, caseName);
        const subject = isFileName ? digitless.replace(/\.[^.]*$/u, '') : digitless;
        return subject.split('.').every((segment) => hasCase(segment, caseName));
    });
    return isMatched ? undefined : { rule: 'case', message: `case is ${limits.caseNames.join(' or ')}` };
}

function digitProblem(name: string, rules: PathRule[], policy: EffectivePolicy): NameProblem | undefined {
    if (!policy.isDigitsBanned || !DIGIT.test(name) || rules.some((rule) => rule.isDigitsAllowed)) return undefined;
    return { rule: 'digits', message: 'a digit is not a word' };
}

function lengthProblem(name: string, limits: CategoryLimits): NameProblem | undefined {
    if (limits.maxChars <= 0 || name.length <= limits.maxChars) return undefined;
    return {
        rule: 'length',
        message: `${String(name.length)} characters is over the ceiling of ${String(limits.maxChars)}`,
    };
}

function wordsProblem(words: string[], limits: CategoryLimits): NameProblem | undefined {
    if (limits.maxWords <= 0 || words.length <= limits.maxWords) return undefined;
    return {
        rule: 'words',
        message: `${String(words.length)} words is over the ceiling of ${String(limits.maxWords)}`,
    };
}

function repeatProblem(words: string[], rules: PathRule[], policy: EffectivePolicy): NameProblem | undefined {
    if (!policy.isDuplicatesBanned || rules.some((rule) => rule.isDuplicatesAllowed)) return undefined;
    const repeated = repeatedPart(words);
    return repeated === undefined ? undefined : { rule: 'duplicate-words', message: `"${repeated}" repeats` };
}

function shapeProblems(
    name: string,
    limits: CategoryLimits,
    rules: PathRule[],
    policy: EffectivePolicy,
): (NameProblem | undefined)[] {
    const words = wordsOf(name.split('.', 1)[0] ?? name);
    return [
        digitProblem(name, rules, policy),
        lengthProblem(name, limits),
        wordsProblem(words, limits),
        repeatProblem(words, rules, policy),
    ];
}

function termProblems(identifier: Identifier, parts: string[], context: NamingContext): NameProblem[] {
    const { policy } = context;
    const problems: NameProblem[] = [];
    const terms = context.isTestFile ? policy.terms.filter((term) => term.source !== TEST_GROUP) : policy.terms;
    const banned = bannedTerm(parts, terms);
    if (banned !== undefined)
        problems.push({ rule: 'banned-term', message: `"${banned.term}" is banned`, source: banned.source });
    for (const [term, allowedFor] of policy.reserved) {
        if (!parts.includes(term) || isReservedUseAllowed(allowedFor, identifier.category)) continue;
        problems.push({
            rule: 'reserved-term',
            message: `"${term}" is reserved for ${allowedFor.join(', ')}; this is a ${identifier.kind}`,
        });
    }
    return problems;
}

function callbackProblem(identifier: Identifier, parts: string[], isReactFile: boolean): NameProblem | undefined {
    if (isReactFile || parts[0] !== CALLBACK_VERB || !VERB_CATEGORIES.has(identifier.category)) return undefined;
    return {
        rule: 'callback-verb',
        message: `"${CALLBACK_VERB}" leads a name only in a framework callback position; name what the function does`,
    };
}

/**
 * Everything wrong with one identifier under the policy. An identifier a path rule excludes has no problems.
 * @param identifier the identifier
 * @param context the effective policy, and whether the file is a React file or a test file
 * @returns the problems, empty when the name passes
 */
export function nameProblems(identifier: Identifier, context: NamingContext): NameProblem[] {
    const { policy } = context;
    if (isExempt(policy, identifier)) return [];
    const rules = rulesFor(policy, identifier);
    if (rules.some((rule) => rule.isExcluding)) return [];
    const limits = limitsUnderRules(policy, identifier, rules);
    const name = stripped(identifier.name, rules);
    const parts = splitParts(name);
    const isFileName = identifier.category === 'files';
    const problems = [
        caseProblem(name, limits, isFileName),
        ...shapeProblems(name, limits, rules, policy),
        ...termProblems(identifier, parts, context),
        callbackProblem(identifier, parts, context.isReactFile),
    ];
    return problems.filter((problem) => problem !== undefined);
}

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

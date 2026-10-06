import type { Identifier } from '#cli/types/parsers/naming.ts';
import { NUMBER_PART, NUMERIC_WORDS } from '#cli/config/parsers/naming.ts';
import { rulesFor, ruleLimits } from '#cli/checks/general/naming/policy.ts';
import { hasCase, splitParts, repeatedPart } from '#cli/parsers/naming/names.ts';
import { DIGIT, CALLBACK_VERB, RESERVED_USES, VERB_CATEGORIES } from '#cli/config/checks/general/naming.ts';

import type {
    Term,
    PathRule,
    NameProblem,
    NamingInputs,
    CategoryLimits,
    EffectivePolicy,
} from '#cli/types/checks/general/naming.ts';

function isConsecutive(parts: string[], termParts: string[]): boolean {
    for (let start = 0; start + termParts.length <= parts.length; start += 1) {
        if (termParts.every((part, index) => parts[start + index] === part)) return true;
    }
    return false;
}

/**
 * True when the whole identifier is exempt: an external name, an allowed name, or a fixed key in its file.
 * @param policy the effective policy
 * @param identifier the identifier
 * @returns whether no naming check applies
 */
function isExempt(policy: EffectivePolicy, identifier: Identifier): boolean {
    if (policy.external.has(identifier.name) || policy.allowed.has(identifier.name)) return true;
    return policy.fixedKeys.get(identifier.file)?.has(identifier.name) ?? false;
}

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
        if (caseName === 'timestamp-snake') return hasCase(name, caseName);
        const subject = isFileName ? digitless.replace(/\.[^.]*$/u, '') : digitless;
        return subject.split('.').every((segment) => hasCase(segment, caseName));
    });
    return isMatched ? undefined : { rule: 'case', message: `expected ${limits.caseNames.join(' or ')} case` };
}

function digitProblem(parts: string[], rules: PathRule[], policy: EffectivePolicy): NameProblem | undefined {
    if (
        !policy.isDigitsBanned ||
        !parts.some((part) => DIGIT.test(part) && !NUMERIC_WORDS.has(part)) ||
        rules.some((rule) => rule.isDigitsAllowed)
    )
        return undefined;
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
    if (!policy.isRepeatBanned || rules.some((rule) => rule.isRepeatAllowed)) return undefined;
    const repeated = repeatedPart(words);
    return repeated === undefined ? undefined : { rule: 'duplicate-words', message: `"${repeated}" repeats` };
}

function termProblems(identifier: Identifier, parts: string[], context: NamingInputs): NameProblem[] {
    const { policy } = context;
    const problems: NameProblem[] = [];
    const terms = context.isTestFile ? policy.terms.filter((term) => term.group !== 'tests') : policy.terms;
    const banned = bannedTerm(parts, terms);
    if (banned !== undefined)
        problems.push({ rule: 'banned-term', message: `"${banned.term}" is banned`, source: banned.source });
    for (const [term, allowedFor] of policy.reserved) {
        if (!parts.includes(term) || isUseAllowed(allowedFor, identifier.category)) continue;
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
 * The first banned term the parts carry: a one-word term equals a part, a longer one matches consecutive parts.
 * @param parts the identifier's parts
 * @param terms the compiled terms
 * @returns the term, or undefined
 */
export function bannedTerm(parts: string[], terms: Term[]): Term | undefined {
    return terms.find((term) => isConsecutive(parts, term.parts));
}

/**
 * True when a reserved term is allowed for an identifier's category.
 * @param allowedFor the uses the policy allows the term for
 * @param category the identifier's category
 * @returns whether the policy allows the term for this category
 */
export function isUseAllowed(allowedFor: string[], category: string): boolean {
    return allowedFor.some((use) => {
        const categories = Object.entries(RESERVED_USES).find(([suffix]) => use.endsWith(suffix))?.[1] ?? [];
        return categories.includes('*') || categories.includes(category);
    });
}

/**
 * Everything wrong with one identifier under the policy. An identifier a path rule excludes has no problems.
 * @param identifier the identifier
 * @param context the effective policy, and whether the file is a React file or a test file
 * @returns the problems, empty when the name passes
 */
export function nameProblems(identifier: Identifier, context: NamingInputs): NameProblem[] {
    const { policy } = context;
    if (isExempt(policy, identifier)) return [];
    const rules = rulesFor(policy, identifier);
    if (rules.some((rule) => rule.excludes)) return [];
    const limits = ruleLimits(policy, identifier, rules);
    const name = stripped(identifier.name, rules);
    const parts = splitParts(name);
    const words = splitParts(name.split('.', 1)[0] ?? name).filter((part) => !NUMBER_PART.test(part));
    const isFileName = identifier.category === 'files';
    const problems = [
        caseProblem(name, limits, isFileName),
        digitProblem(parts, rules, policy),
        lengthProblem(name, limits),
        wordsProblem(words, limits),
        repeatProblem(words, rules, policy),
        ...termProblems(identifier, parts, context),
        callbackProblem(identifier, parts, context.isReactFile),
    ];
    return problems.filter((problem) => problem !== undefined);
}

import { createRule } from '../../rule.ts';
import { buildRegexVisitors } from '../../language/regex.ts';
import { type AST, visitRegExpAST } from '@eslint-community/regexpp';

import {
    CHOICE_BASE,
    LOOKAROUND_KINDS,
    DEFAULT_REGEX_COMPLEXITY,
    REGEX_COMPLEXITY_OPTIONS_SCHEMA,
} from '../../config/regex.ts';

function getDeepening(node: AST.Node): number {
    if (node.type === 'Quantifier' || node.type === 'CharacterClass') return 1;
    const choices = 'alternatives' in node && node.alternatives.length > 1 ? 1 : 0;
    return node.type === 'Assertion' && LOOKAROUND_KINDS.has(node.kind) ? 1 + choices : choices;
}

function getDepth(node: AST.Node): number {
    let depth = 1;
    for (let ancestor = node.parent; ancestor !== null; ancestor = ancestor.parent) depth += getDeepening(ancestor);
    return depth;
}

function scoreChoice(node: AST.Pattern | AST.Group | AST.CapturingGroup | AST.LookaroundAssertion, offset = 0) {
    const count = node.alternatives.length;
    if (count < CHOICE_BASE) return 0;
    return getDepth(node) + offset + count - CHOICE_BASE;
}

function scoreRegex(regex: AST.RegExpLiteral): number {
    let score = 0;
    visitRegExpAST(regex, {
        onPatternEnter: (node) => (score += scoreChoice(node)),
        onGroupEnter: (node) => (score += scoreChoice(node)),
        onCapturingGroupEnter: (node) => (score += scoreChoice(node)),
        onAssertionEnter: (node) => {
            if (!LOOKAROUND_KINDS.has(node.kind) || !('alternatives' in node)) return;
            score += getDepth(node) + scoreChoice(node, 1);
        },
        onBackreferenceEnter: () => (score += 1),
        onCharacterClassEnter: () => (score += 1),
        onQuantifierEnter: (node) => (score += getDepth(node)),
    });
    return score;
}

export const maxRegexComplexity = createRule<[{ threshold: number }], 'complex'>({
    name: 'max-regex-complexity',
    meta: {
        defaultOptions: [{ threshold: DEFAULT_REGEX_COMPLEXITY }],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports a regular expression whose complexity passes `threshold`, 20 by default. Each quantifier and lookaround adds its nesting depth, each further alternative adds one more for the first, and each character class and backreference adds one. Quantifiers, lookarounds, character classes, and groups with alternatives deepen the nesting.',
            why: 'A long, nested regular expression is hard to read and to change without breaking a case.',
            fix: 'Split the expression into smaller named parts, or check parts of the input with plain code.',
            example:
                'A pattern that nests alternatives inside repeated groups three levels deep can pass 20 and report `complex`.',
        },
        schema: [REGEX_COMPLEXITY_OPTIONS_SCHEMA],
        messages: {
            complex: 'This regular expression has a complexity of {{score}}. Simplify it to {{threshold}} or less.',
        },
    },
    create(context, [{ threshold }]) {
        return buildRegexVisitors((node, regex) => {
            const score = scoreRegex(regex);
            if (score > threshold) context.report({ node, messageId: 'complex', data: { score, threshold } });
        }, context.sourceCode);
    },
});

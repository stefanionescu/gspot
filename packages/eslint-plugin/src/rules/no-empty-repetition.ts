import { createRule } from '../rule.ts';
import { buildRegexVisitors } from '../regex.ts';
import { type AST, visitRegExpAST } from '@eslint-community/regexpp';

function matchesEmpty(node: AST.Node): boolean {
    switch (node.type) {
        case 'Alternative': {
            return node.elements.every((element) => matchesEmpty(element));
        }
        case 'Assertion': {
            return true;
        }
        case 'CapturingGroup':
        case 'Group':
        case 'Pattern': {
            return node.alternatives.some((alternative) => matchesEmpty(alternative));
        }
        case 'Quantifier': {
            return node.min === 0;
        }
        default: {
            return false;
        }
    }
}

export const noEmptyRepetition = createRule<[], 'empty'>({
    name: 'no-empty-repetition',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a quantifier in a regular expression whose element can match the empty string, such as `(a*)*`, `(?:a|)+`, or `(\\b)*`, in a literal or a `RegExp` call with a known pattern.',
            why: 'Repeating something that can match nothing gains nothing, and can make the engine backtrack for a long time.',
            fix: 'Make the repeated element match at least one character, or remove the outer quantifier.',
            example: '`/(a*)*b/` reports `empty`. Write `/a*b/`.',
        },
        schema: [],
        messages: {
            empty: 'The repeated part {{part}} can match the empty string. Make it match at least one character.',
        },
    },
    create(context) {
        return buildRegexVisitors((node, regex) => {
            visitRegExpAST(regex, {
                onQuantifierEnter: (quantifier) => {
                    if (matchesEmpty(quantifier.element))
                        context.report({ node, messageId: 'empty', data: { part: quantifier.element.raw } });
                },
            });
        }, context.sourceCode);
    },
});

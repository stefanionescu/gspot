import { createRule } from '../rule.ts';
import { STRING_PATTERN_METHODS } from '../config/regex.ts';
import { getTypes, getTypeCategory } from '../language/checker.ts';
import { ASTUtils, AST_NODE_TYPES } from '@typescript-eslint/utils';

export const noStringRegexPattern = createRule<[], 'pattern'>({
    name: 'no-string-regex-pattern',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a string passed as the pattern of `match`, `matchAll`, or `search` on a string. It needs type information and reports nothing without it.',
            why: 'These methods compile a string argument as a regular expression, so `.` or `?` in it change the match, and the regular expression rules cannot check a pattern hidden in a string.',
            fix: 'Pass a regular expression literal, or `new RegExp(pattern)` when the pattern is built at run time.',
            example: '`title.match("v1.2")` reports `pattern`. Write `title.match(/v1\\.2/u)`.',
        },
        schema: [],
        messages: { pattern: '{{method}} compiles this string as a regular expression. Pass a RegExp instead.' },
    },
    create(context) {
        const types = getTypes(context);
        if (types === undefined) return {};
        return {
            CallExpression(node) {
                const { callee } = node;
                const [pattern] = node.arguments;
                if (callee.type !== AST_NODE_TYPES.MemberExpression || pattern === undefined) return;
                const method = ASTUtils.getPropertyName(callee);
                if (!STRING_PATTERN_METHODS.has(method)) return;
                const isString = getTypeCategory(types, types.get(callee.object)) === 'string';
                if (!isString || getTypeCategory(types, types.get(pattern)) !== 'string') return;
                context.report({ node: pattern, messageId: 'pattern', data: { method } });
            },
        };
    },
});

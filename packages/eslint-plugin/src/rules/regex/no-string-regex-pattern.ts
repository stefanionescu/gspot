import { AST_NODE_TYPES, ASTUtils } from '@typescript-eslint/utils';

import { STRING_PATTERN_METHODS } from '../../config/regex.ts';
import { getTypeCategory, getTypes } from '../../language/checker.ts';
import { createRule } from '../../rule.ts';

export const noStringRegexPattern = createRule<[], 'pattern'>({
    name: 'no-string-regex-pattern',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            requiresTypeChecking: true,
            description: 'Reports a string passed as the pattern of `match`, `matchAll`, or `search` on a string.',
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
                if (pattern === undefined || callee.type !== AST_NODE_TYPES.MemberExpression) return;
                const method = ASTUtils.getPropertyName(callee);
                if (!STRING_PATTERN_METHODS.has(method)) return;
                const isString = getTypeCategory(types, types.get(callee.object)) === 'string';
                if (!isString || getTypeCategory(types, types.get(pattern)) !== 'string') return;
                context.report({ node: pattern, messageId: 'pattern', data: { method } });
            },
        };
    },
});

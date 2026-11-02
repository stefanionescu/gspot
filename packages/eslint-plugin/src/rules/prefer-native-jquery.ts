import { createRule } from '../rule.ts';
import { getModuleName } from '../modules.ts';
import type { MemberCall } from '../types/rules.ts';
import { ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { JQUERY_GLOBALS, JQUERY_METHODS, JQUERY_ORIGINS } from '../config/frameworks.ts';

function isJquery(receiver: TSESTree.Identifier, source: TSESLint.SourceCode): boolean {
    const variable = ASTUtils.findVariable(source.getScope(receiver), receiver);
    if ((variable?.defs.length ?? 0) === 0) return JQUERY_GLOBALS.has(receiver.name);
    const origin = (getModuleName(receiver, source) ?? '').replaceAll('/', '.');
    return JQUERY_ORIGINS.has(origin);
}

export const preferNativeJquery = createRule<[], 'deprecated' | 'dependency'>({
    name: 'prefer-native-jquery',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports `isArray`, `parseJSON`, `now`, `trim`, and `inArray` called on jQuery: the `$` or `jQuery` global, or a binding imported or required from jquery.',
            why: 'The language now has each of these functions, so the jQuery copies only keep the dependency alive, and jQuery has deprecated four of them.',
            fix: 'Call the native function: `Array.isArray()`, `JSON.parse()`, `Date.now()`, `String.prototype.trim()`, or `Array.prototype.indexOf()`.',
            example: '`$.isArray(rows)` reports `deprecated`. Write `Array.isArray(rows)`.',
        },
        schema: [],
        messages: {
            deprecated: 'Use {{alternative}} instead of deprecated jQuery.{{method}}().',
            dependency: 'Use {{alternative}} instead of jQuery.{{method}}() to reduce dependence on jQuery.',
        },
    },
    create(context) {
        return {
            'CallExpression[optional=false][callee.type="MemberExpression"][callee.optional=false][callee.computed=false][callee.object.type="Identifier"]'(
                node: MemberCall,
            ) {
                const method = ASTUtils.getPropertyName(node.callee);
                const replacement = JQUERY_METHODS.get(method);
                const receiver = node.callee.object;
                if (
                    replacement === undefined ||
                    !ASTUtils.isIdentifier(receiver) ||
                    !isJquery(receiver, context.sourceCode)
                )
                    return;
                context.report({
                    node: node.callee.property,
                    messageId: replacement.isDeprecated ? 'deprecated' : 'dependency',
                    data: { alternative: replacement.alternative, method },
                });
            },
        };
    },
});

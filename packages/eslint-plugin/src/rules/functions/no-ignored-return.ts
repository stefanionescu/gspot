import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import { listChildren } from '../../language/syntax.ts';
import type { TypeReader } from '../../types/plugin.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { PURE_METHODS, REPLACE_METHOD, EARLY_EXIT_METHODS, PURE_RECEIVER_SYMBOLS } from '../../config/functions.ts';

function getReceiver(node: TSESTree.Node, types: TypeReader): string | undefined {
    const type = types.get(node);
    const base = types.checker.typeToString(types.checker.getBaseTypeOfLiteralType(type));
    if (base === 'number' || base === 'string') return base;
    const name = type.getSymbol()?.getName();
    return name !== undefined && PURE_RECEIVER_SYMBOLS.has(name) ? name.toLowerCase() : undefined;
}

function hasAssignment(node: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    if (node.type === AST_NODE_TYPES.AssignmentExpression) return true;
    return (
        !ASTUtils.isFunction(node) &&
        listChildren(node, source.visitorKeys).some((child) => hasAssignment(child, source))
    );
}

function getPureMethod(callee: TSESTree.MemberExpression, types: TypeReader, source: TSESLint.SourceCode) {
    const method = source.getText(callee.property);
    const receiver = getReceiver(callee.object, types);
    return receiver !== undefined && PURE_METHODS[receiver]?.has(method) === true ? method : undefined;
}

function isIntended(method: string, node: TSESTree.CallExpression, types: TypeReader, source: TSESLint.SourceCode) {
    const [first, second] = node.arguments;
    if (method === REPLACE_METHOD && second !== undefined) return types.get(second).getCallSignatures().length > 0;
    const isInline =
        first?.type === AST_NODE_TYPES.ArrowFunctionExpression || first?.type === AST_NODE_TYPES.FunctionExpression;
    return EARLY_EXIT_METHODS.has(method) && isInline && hasAssignment(first.body, source);
}

export const noIgnoredReturn = createRule<[], 'ignored' | 'map'>({
    name: 'no-ignored-return',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            requiresTypeChecking: true,
            description:
                'Reports a call statement that drops the result of a method without side effects on a string, number, array, Date, Math, or RegExp value, such as `name.trim();`.',
            why: 'These methods return a new value and change nothing, so a call whose result is dropped does nothing.',
            fix: 'Use the result, such as `name = name.trim();`, or delete the call. Use `forEach` instead of `map` to run a callback for each item.',
            example: '`title.toUpperCase();` reports `ignored`. Write `title = title.toUpperCase();`.',
        },
        schema: [],
        messages: {
            ignored: 'The result of {{method}} is dropped, and the call does nothing else. Use the result.',
            map: 'The result of map is dropped. Use forEach to run the callback for each item.',
        },
    },
    create(context) {
        const types = getTypes(context);
        if (types === undefined) return {};
        return {
            'ExpressionStatement > CallExpression'(node: TSESTree.CallExpression) {
                const { callee } = node;
                if (callee.type !== AST_NODE_TYPES.MemberExpression) return;
                const method = getPureMethod(callee, types, context.sourceCode);
                if (method === undefined || isIntended(method, node, types, context.sourceCode)) return;
                context.report({ node, messageId: method === 'map' ? 'map' : 'ignored', data: { method } });
            },
        };
    },
});

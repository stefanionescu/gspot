import { createRule } from '../../rule.ts';
import { getTypes } from '../../language/checker.ts';
import type { TypeReader } from '../../types/plugin.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

import {
    VOID_TYPE,
    ARRAY_NAME,
    ARRAY_TYPE_NAMES,
    ARRAY_FROM_METHOD,
    ARRAY_CALLBACK_METHODS,
} from '../../config/collections.ts';

function isArrayFrom(callee: TSESTree.MemberExpression): boolean {
    const { object, property } = callee;
    const isArray = ASTUtils.isIdentifier(object) && object.name === ARRAY_NAME;
    return isArray && ASTUtils.isIdentifier(property) && property.name === ARRAY_FROM_METHOD;
}

function getCallback(call: TSESTree.CallExpression, types: TypeReader): TSESTree.CallExpressionArgument | undefined {
    const { callee, arguments: values } = call;
    if (callee.type !== AST_NODE_TYPES.MemberExpression) return undefined;
    const isMethod = ARRAY_CALLBACK_METHODS.has(ASTUtils.getPropertyName(callee));
    if (isMethod && ARRAY_TYPE_NAMES.has(types.get(callee.object).getSymbol()?.name)) return values[0];
    return isArrayFrom(callee) ? values[1] : undefined;
}

function isVoidCallback(callback: TSESTree.CallExpressionArgument, types: TypeReader): boolean {
    const isBlockFunction = ASTUtils.isFunction(callback) && callback.body.type === AST_NODE_TYPES.BlockStatement;
    if (isBlockFunction || callback.type === AST_NODE_TYPES.SpreadElement) return false;
    const signatures = types.get(callback).getCallSignatures();
    return (
        signatures.length > 0 &&
        signatures.every((signature) => types.checker.typeToString(signature.getReturnType()) === VOID_TYPE)
    );
}

function getCallbackLocation(callback: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.SourceLocation {
    if (callback.type !== AST_NODE_TYPES.ArrowFunctionExpression) return callback.loc;
    const arrow = source.getTokenBefore(callback.body, { filter: ({ value }) => value === '=>' });
    return arrow?.loc ?? callback.loc;
}

export const noVoidArrayCallback = createRule<[], 'void'>({
    name: 'no-void-array-callback',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a callback passed to an array method that uses its result, such as `map`, `filter`, `find`, `some`, `every`, `reduce`, `flatMap`, `sort`, and `toSorted`, or as the second argument of `Array.from`, when every call signature of the callback returns `void`. A function written inline with a block body does not count, because `array-callback-return` reports it. The rule needs type information.',
            why: 'These methods use the value that the callback returns, so a callback that returns nothing makes them produce `undefined` values, empty results, or an unchanged order.',
            fix: 'Pass a callback that returns the value the method needs, or call `forEach` when only the side effects matter.',
            example: '`declare function log(value: number): void; [1, 2].map(log);` reports `void` at `log`.',
        },
        schema: [],
        messages: { void: 'This callback returns nothing, but {{method}} uses its result.' },
    },
    create(context) {
        const source = context.sourceCode;
        const types = getTypes(context);
        if (types === undefined) return {};
        return {
            CallExpression(call) {
                const callback = getCallback(call, types);
                if (callback === undefined || !isVoidCallback(callback, types)) return;
                const method = source.getText(call.callee);
                context.report({ loc: getCallbackLocation(callback, source), messageId: 'void', data: { method } });
            },
        };
    },
});

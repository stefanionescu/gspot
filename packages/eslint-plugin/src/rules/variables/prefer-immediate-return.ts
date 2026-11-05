import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

import { IMMEDIATE_RETURN_DECLARATION } from '../../config/variables.ts';
import { getNextStatement } from '../../language/syntax.ts';
import { createRule } from '../../rule.ts';

function getExitStatement(
    node: TSESTree.VariableDeclaration,
): TSESTree.ReturnStatement | TSESTree.ThrowStatement | undefined {
    const next = getNextStatement(node);
    if (next?.type === AST_NODE_TYPES.ReturnStatement) return next;
    return next?.type === AST_NODE_TYPES.ThrowStatement ? next : undefined;
}

export const preferImmediateReturn = createRule<[], 'immediate'>({
    name: 'prefer-immediate-return',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description: 'Reports a variable created only to return or throw its value on the next statement.',
            why: 'An intermediate variable adds a name without adding a step to the computation.',
            fix: 'Return or throw the initializer directly. Keep variables that enforce a type or have another use.',
            example: '`const result = read(); return result;` becomes `return read();`.',
        },
        schema: [],
        messages: { immediate: 'Use the initializer directly in this {{action}} statement.' },
    },
    create(context) {
        return {
            [IMMEDIATE_RETURN_DECLARATION](declaration: TSESTree.VariableDeclarator) {
                const node = declaration.parent;
                const next = getExitStatement(node);
                if (next?.argument?.type !== AST_NODE_TYPES.Identifier) return;
                const argument = next.argument;
                const references = context.sourceCode
                    .getDeclaredVariables(node)
                    .flatMap((variable) => variable.references);
                if (
                    references.some((reference) => reference.identifier === argument) &&
                    references.filter((reference) => reference.isRead()).length === 1
                )
                    context.report({
                        node,
                        messageId: 'immediate',
                        data: { action: next.type === AST_NODE_TYPES.ReturnStatement ? 'return' : 'throw' },
                    });
            },
        };
    },
});

import { createRule } from '../rule.ts';
import { PROMISE_NAME, SETTLE_ACTIONS } from '../config/builtins.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function getSoleExpression(body: TSESTree.Node): TSESTree.Node | undefined {
    if (body.type !== AST_NODE_TYPES.BlockStatement) return body;
    const [statement] = body.body;
    return body.body.length === 1 && statement?.type === AST_NODE_TYPES.ExpressionStatement
        ? statement.expression
        : undefined;
}

function getExecutor(
    node: TSESTree.NewExpression,
): TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression | undefined {
    const [executor] = node.arguments;
    if (!ASTUtils.isIdentifier(node.callee) || node.callee.name !== PROMISE_NAME || node.arguments.length !== 1)
        return undefined;
    const isExecutor =
        executor?.type === AST_NODE_TYPES.FunctionExpression ||
        executor?.type === AST_NODE_TYPES.ArrowFunctionExpression;
    return isExecutor ? executor : undefined;
}

function getSettleAction(node: TSESTree.NewExpression): string | undefined {
    const executor = getExecutor(node);
    if (executor === undefined) return undefined;
    const call = getSoleExpression(executor.body);
    if (call?.type !== AST_NODE_TYPES.CallExpression || call.arguments.length !== 1) return undefined;
    const { callee } = call;
    if (!ASTUtils.isIdentifier(callee)) return undefined;
    const index = executor.params.findIndex(
        (parameter) => ASTUtils.isIdentifier(parameter) && parameter.name === callee.name,
    );
    return SETTLE_ACTIONS[index];
}

export const preferPromiseShorthand = createRule<[], 'shorthand'>({
    name: 'prefer-promise-shorthand',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'all',
            description:
                'Reports `new Promise` whose executor only calls its resolve or reject parameter with one argument.',
            why: 'A promise that settles at once reads more clearly as `Promise.resolve(value)` or `Promise.reject(error)`.',
            fix: 'Replace the constructor with `Promise.resolve(value)` or `Promise.reject(error)`.',
            example: '`new Promise((resolve) => resolve(value))` reports `shorthand`. Write `Promise.resolve(value)`.',
        },
        schema: [],
        messages: { shorthand: 'Replace this promise with Promise.{{action}}.' },
    },
    create(context) {
        return {
            NewExpression(node) {
                const action = getSettleAction(node);
                if (action === undefined) return;
                context.report({ node: node.callee, messageId: 'shorthand', data: { action } });
            },
        };
    },
});

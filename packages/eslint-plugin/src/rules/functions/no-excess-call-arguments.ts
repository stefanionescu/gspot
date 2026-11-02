import { createRule } from '../../rule.ts';
import type { LocalFunction } from '../../types/plugin.ts';
import { getLocalFunction } from '../../language/functions.ts';
import { ASTUtils, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

export const noExcessCallArguments = createRule<[], 'arguments'>({
    name: 'no-excess-call-arguments',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports more call arguments than a local function declares, unless it accepts variadic arguments.',
            why: 'An extra argument can hide a mistaken function call or an outdated parameter list.',
            fix: 'Remove the extra arguments, or declare the parameters the function uses.',
            example: '`function read(value) { return value; } read(first, second);` reports the extra argument.',
        },
        schema: [],
        messages: {
            arguments:
                'This function declares {{parameters}} parameters, but the call supplies {{arguments}} arguments.',
        },
    },
    create(context) {
        const calls = new Map<TSESTree.CallExpression, LocalFunction>();
        const variadic = new Set<TSESTree.Node>();
        return {
            CallExpression(node) {
                const declaration = getLocalFunction(node.callee, context.sourceCode);
                if (
                    declaration === undefined ||
                    node.arguments.length <= declaration.params.length ||
                    declaration.params.some((parameter) => parameter.type === AST_NODE_TYPES.RestElement)
                )
                    return;
                calls.set(node, declaration);
            },
            Identifier(node) {
                if (node.name !== 'arguments') return;
                const variable = ASTUtils.findVariable(context.sourceCode.getScope(node), node);
                if (variable !== null && variable.defs.length > 0) return;
                const owner = context.sourceCode
                    .getAncestors(node)
                    .findLast(
                        (ancestor) =>
                            ancestor.type === AST_NODE_TYPES.FunctionDeclaration ||
                            ancestor.type === AST_NODE_TYPES.FunctionExpression,
                    );
                if (owner !== undefined) variadic.add(owner);
            },
            'Program:exit'() {
                for (const [call, declaration] of calls) {
                    if (variadic.has(declaration)) continue;
                    if (
                        declaration.type !== AST_NODE_TYPES.TSDeclareFunction &&
                        declaration.params.length === 0 &&
                        declaration.body.type === AST_NODE_TYPES.BlockStatement &&
                        declaration.body.body.length === 0
                    )
                        continue;
                    context.report({
                        node: call.callee,
                        messageId: 'arguments',
                        data: { parameters: declaration.params.length, arguments: call.arguments.length },
                    });
                }
            },
        };
    },
});

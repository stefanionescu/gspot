import { createRule } from '../../rule.ts';
import { FUNCTION_NODES } from '../../config/plugin.ts';
import type { LocalFunction } from '../../types/plugin.ts';
import { getLocalFunction } from '../../language/functions.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { EMPTY_RETURN_TYPES, UNUSED_CALL_PARENTS } from '../../config/functions.ts';

function isCallValueUsed(node: TSESTree.CallExpression | TSESTree.SequenceExpression): boolean {
    const { parent } = node;
    switch (parent.type) {
        case AST_NODE_TYPES.LogicalExpression: {
            return parent.left === node;
        }
        case AST_NODE_TYPES.ConditionalExpression: {
            return parent.test === node;
        }
        case AST_NODE_TYPES.SequenceExpression: {
            return parent.expressions.at(-1) === node && isCallValueUsed(parent);
        }
        default: {
            return !UNUSED_CALL_PARENTS.has(parent.type);
        }
    }
}

function hasReturnValue(declaration: LocalFunction, returning: Set<TSESTree.Node>): boolean {
    if (declaration.type === AST_NODE_TYPES.TSDeclareFunction) {
        const annotation = declaration.returnType?.typeAnnotation.type;
        return annotation !== undefined && !EMPTY_RETURN_TYPES.has(annotation);
    }
    return (
        declaration.async ||
        declaration.generator ||
        returning.has(declaration) ||
        declaration.body.type !== AST_NODE_TYPES.BlockStatement ||
        declaration.body.body.length === 0
    );
}

export const noEmptyReturnValue = createRule<[], 'return'>({
    name: 'no-empty-return-value',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Reports using the result of a local function that has no value-returning statement.',
            why: 'Using a missing return value passes undefined into code that expects a result.',
            fix: 'Return the intended value from the function, or call it without using its result.',
            example: "`function write() { save(); } const value = write();` reports the use of write's result.",
        },
        schema: [],
        messages: {
            return: 'This function does not return a value. Call it without using its result, or return the intended value.',
        },
    },
    create(context) {
        const calls = new Map<TSESTree.CallExpression, LocalFunction>();
        const returning = new Set<TSESTree.Node>();
        return {
            CallExpression(node) {
                if (node.callee.type !== AST_NODE_TYPES.Identifier || !isCallValueUsed(node)) return;
                const declaration = getLocalFunction(node.callee, context.sourceCode);
                if (declaration !== undefined) calls.set(node, declaration);
            },
            ReturnStatement(node) {
                if (node.argument === null) return;
                const owner = context.sourceCode
                    .getAncestors(node)
                    .findLast((ancestor) => FUNCTION_NODES.has(ancestor.type));
                if (owner !== undefined) returning.add(owner);
            },
            'Program:exit'() {
                for (const [call, declaration] of calls) {
                    if (hasReturnValue(declaration, returning)) continue;
                    context.report({ node: call.callee, messageId: 'return' });
                }
            },
        };
    },
});

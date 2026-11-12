import { AST_NODE_TYPES, ASTUtils, type TSESTree } from '@typescript-eslint/utils';

import { CALL_NODES, CATCH_METHOD, CHAINED_USES, HANDLING_PARENTS } from '../../config/functions.ts';
import { getTypes, isThenable } from '../../language/checker.ts';
import { listBodyNodes } from '../../language/syntax.ts';
import { createRule } from '../../rule.ts';
import type { PromiseUse } from '../../types/functions.ts';
import type { TypeReader } from '../../types/plugin.ts';

function getChainedUse(node: TSESTree.Node): PromiseUse {
    const { parent } = node;
    if (parent?.type !== AST_NODE_TYPES.MemberExpression || parent.object !== node) return 'open';
    return CHAINED_USES.get(ASTUtils.getPropertyName(parent)) ?? 'open';
}

function isCatchCall(call: TSESTree.Node): boolean {
    if (call.type !== AST_NODE_TYPES.CallExpression) return false;
    const { callee } = call;
    return callee.type === AST_NODE_TYPES.MemberExpression && ASTUtils.getPropertyName(callee) === CATCH_METHOD;
}

function classifyCall(call: TSESTree.Node, types: TypeReader): PromiseUse {
    if (call.type === AST_NODE_TYPES.AwaitExpression || !isThenable(types, call)) return 'blocking';
    const parentType = call.parent?.type;
    return isCatchCall(call) || (parentType !== undefined && HANDLING_PARENTS.has(parentType))
        ? 'handled'
        : getChainedUse(call);
}

export const noTryPromise = createRule<[], 'open' | 'caught'>({
    name: 'no-try-promise',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            requiresTypeChecking: true,
            description:
                'Reports a `try` statement whose body only starts promises that it does not await, because the `catch` clause never sees their rejections.',
            why: 'A catch clause sees only errors thrown while the try body runs, not a promise that rejects later.',
            fix: 'Await the promise inside the try, or handle its rejection with `.catch` and remove the try.',
            example:
                '`try { save(record); } catch (error) { report(error); }` reports `open` when `save` returns a promise.',
        },
        schema: [],
        messages: {
            open: 'The catch clause does not see this rejected promise. Await it, or use .catch instead of try.',
            caught: 'Every promise here already has .catch. Remove this try statement.',
        },
    },
    create(context) {
        const types = getTypes(context);
        if (types === undefined) return {};
        return {
            TryStatement(node) {
                const uses = new Set(
                    listBodyNodes(node.block, context.sourceCode)
                        .filter((each) => CALL_NODES.has(each.type))
                        .map((call) => classifyCall(call, types)),
                );
                if (node.handler === null || uses.has('blocking')) return;
                const loc = { start: node.loc.start, end: node.block.loc.start };
                if (uses.has('open')) context.report({ loc, messageId: 'open' });
                else if (uses.has('caught')) context.report({ loc, messageId: 'caught' });
            },
        };
    },
});

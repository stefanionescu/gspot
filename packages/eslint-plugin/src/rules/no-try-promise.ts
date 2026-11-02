import { createRule } from '../rule.ts';
import { listChildren } from '../syntax.ts';
import type { PromiseUse } from '../types/rules.ts';
import { getTypes, isThenable } from '../checker.ts';
import type { TypeReader } from '../types/plugin.ts';
import { CALL_NODES, CHAINED_USES, CATCH_METHOD, HANDLING_PARENTS } from '../config/builtins.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function listCalls(node: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node[] {
    if (ASTUtils.isFunction(node)) return [];
    const isCall = CALL_NODES.has(node.type);
    const calls = listChildren(node, source.visitorKeys).flatMap((child) => listCalls(child, source));
    return isCall ? [node, ...calls] : calls;
}

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
    if (isCatchCall(call) || (parentType !== undefined && HANDLING_PARENTS.has(parentType))) return 'handled';
    return getChainedUse(call);
}

export const noTryPromise = createRule<[], 'open' | 'caught'>({
    name: 'no-try-promise',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a try statement whose body only starts promises: a promise that nothing awaits, chains, or catches escapes the catch clause, and a try around promises that all have `.catch` adds nothing. A try body with an `await` or a call that returns no promise passes. It needs type information and reports nothing without it.',
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
                    listCalls(node.block, context.sourceCode).map((call) => classifyCall(call, types)),
                );
                if (node.handler === null || uses.has('blocking')) return;
                const loc = { start: node.loc.start, end: node.block.loc.start };
                if (uses.has('open')) context.report({ loc, messageId: 'open' });
                else if (uses.has('caught')) context.report({ loc, messageId: 'caught' });
            },
        };
    },
});

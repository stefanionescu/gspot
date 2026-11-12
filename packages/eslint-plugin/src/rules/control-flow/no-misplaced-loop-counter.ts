import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { haveSameTokens, listChildren } from '../../language/syntax.ts';
import { createRule } from '../../rule.ts';

function listAssignedNodes(node: TSESTree.Node): TSESTree.Node[] {
    if (node.type === AST_NODE_TYPES.ObjectPattern)
        return node.properties.flatMap((property) =>
            listAssignedNodes(property.type === AST_NODE_TYPES.Property ? property.value : property.argument),
        );
    return node.type === AST_NODE_TYPES.ArrayPattern
        ? node.elements.filter((element) => element !== null).flatMap((element) => listAssignedNodes(element))
        : [node];
}

function listCallTargets(node: TSESTree.Node): TSESTree.Node[] {
    if (node.type !== AST_NODE_TYPES.CallExpression || node.callee.type !== AST_NODE_TYPES.MemberExpression) return [];
    let target: TSESTree.Node = node.callee;
    while (target.type === AST_NODE_TYPES.MemberExpression && target.object.type !== AST_NODE_TYPES.ThisExpression)
        target = target.object;
    return target.type === AST_NODE_TYPES.Identifier || target.type === AST_NODE_TYPES.MemberExpression ? [target] : [];
}

function listDescendants(node: TSESTree.Node, visitorKeys: TSESLint.SourceCode['visitorKeys']): TSESTree.Node[] {
    const nodes: TSESTree.Node[] = [];
    const pending = [node];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
        nodes.push(next);
        pending.push(...listChildren(next, visitorKeys).toReversed());
    }
    return nodes;
}

function listUpdatedNodes(update: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node[] {
    return listDescendants(update, source.visitorKeys).flatMap((node): TSESTree.Node[] => {
        if (node.type === AST_NODE_TYPES.AssignmentExpression) return listAssignedNodes(node.left);
        return node.type === AST_NODE_TYPES.UpdateExpression ? [node.argument] : listCallTargets(node);
    });
}

function listTestedNodes(test: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node[] {
    return listDescendants(test, source.visitorKeys).filter((node) => {
        if (node.type === AST_NODE_TYPES.Identifier) {
            const { parent } = node;
            return parent.type !== AST_NODE_TYPES.MemberExpression || parent.computed || parent.object === node;
        }
        if (node.type !== AST_NODE_TYPES.MemberExpression) return false;
        const isOutermost =
            node.parent.type !== AST_NODE_TYPES.MemberExpression && node.parent.type !== AST_NODE_TYPES.CallExpression;
        return isOutermost || node.object.type === AST_NODE_TYPES.ThisExpression;
    });
}

export const noMisplacedLoopCounter = createRule<[], 'misplaced'>({
    name: 'no-misplaced-loop-counter',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports a `for` loop whose update and body change none of the values that its stop condition reads.',
            why: 'A loop that updates one value and tests another usually updates the wrong counter, and may never stop.',
            fix: 'Update the value that the condition tests, or test the value that the update changes.',
            example: '`for (let row = 0; row < rows; column++)` reports `misplaced`. Update `row` instead.',
        },
        schema: [],
        messages: { misplaced: 'This loop tests {{tested}} but updates {{updated}}. Update the value it tests.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            ForStatement({ test, update, body }) {
                if (test === null || update === null) return;
                const updated = listUpdatedNodes(update, source);
                const tested = listTestedNodes(test, source);
                const changed = [...updated, ...listUpdatedNodes(body, source)];
                if (
                    updated.length === 0 ||
                    tested.length === 0 ||
                    tested.some((first) => changed.some((second) => haveSameTokens(first, second, source)))
                )
                    return;
                context.report({
                    node: test,
                    messageId: 'misplaced',
                    data: {
                        tested: tested.map((node) => source.getText(node)).join(', '),
                        updated: updated.map((node) => source.getText(node)).join(', '),
                    },
                });
            },
        };
    },
});

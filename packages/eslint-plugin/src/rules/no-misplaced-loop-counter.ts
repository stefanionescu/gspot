import { createRule } from '../rule.ts';
import { haveSameTokens, listDescendants } from '../syntax.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function listAssigned(node: TSESTree.Node): TSESTree.Node[] {
    if (node.type === AST_NODE_TYPES.ObjectPattern)
        return node.properties.flatMap((property) =>
            listAssigned(property.type === AST_NODE_TYPES.Property ? property.value : property.argument),
        );
    if (node.type !== AST_NODE_TYPES.ArrayPattern) return [node];
    return node.elements.filter((element) => element !== null).flatMap((element) => listAssigned(element));
}

function listUpdated(update: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node[] {
    return listDescendants(update, source.visitorKeys).flatMap((node): TSESTree.Node[] => {
        if (node.type === AST_NODE_TYPES.AssignmentExpression) return listAssigned(node.left);
        if (node.type === AST_NODE_TYPES.UpdateExpression) return [node.argument];
        if (node.type !== AST_NODE_TYPES.CallExpression || node.callee.type !== AST_NODE_TYPES.MemberExpression)
            return [];
        let target: TSESTree.Node = node.callee;
        while (target.type === AST_NODE_TYPES.MemberExpression) target = target.object;
        return target.type === AST_NODE_TYPES.Identifier ? [target] : [];
    });
}

function listTested(test: TSESTree.Node, source: TSESLint.SourceCode): TSESTree.Node[] {
    return listDescendants(test, source.visitorKeys).filter((node) => {
        const { parent } = node;
        if (parent === undefined) return false;
        if (node.type === AST_NODE_TYPES.Identifier)
            return parent.type !== AST_NODE_TYPES.MemberExpression || parent.computed || parent.object === node;
        return (
            node.type === AST_NODE_TYPES.MemberExpression &&
            parent.type !== AST_NODE_TYPES.MemberExpression &&
            parent.type !== AST_NODE_TYPES.CallExpression
        );
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
                'Reports a for loop whose update and body change none of the values that its stop condition reads. A change counts the targets of assignments, `++` and `--`, and the object of a method call. A condition that reads no value passes.',
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
                const updated = listUpdated(update, source);
                const tested = listTested(test, source);
                const changed = [...updated, ...listUpdated(body, source)];
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

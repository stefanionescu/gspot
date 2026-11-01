import { createRule } from '../rule.ts';
import { unwrapExpression } from '../syntax.ts';
import { TABLE_CALL } from '../config/testing.ts';
import type { TableCall } from '../types/rules.ts';
import { isSameTokens, readTestTable } from '../testing.ts';
import { type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function listCopies(table: TSESTree.Node | undefined, source: TSESLint.SourceCode): TSESTree.Node[][] {
    const value = table === undefined ? undefined : unwrapExpression(table);
    const rows = value?.type === AST_NODE_TYPES.ArrayExpression ? value.elements : [];
    const groups = new Map<TSESTree.Node, TSESTree.Node[]>();
    const values = rows.filter(
        (each): each is TSESTree.Expression => each !== null && each.type !== AST_NODE_TYPES.SpreadElement,
    );
    for (const row of values) {
        const first = [...groups.keys()].find((each) => isSameTokens(each, row, source)) ?? row;
        groups.set(first, [...(groups.get(first) ?? []), row]);
    }
    return [...groups.values()].map((group) => group.slice(1)).filter((copies) => copies.length > 0);
}

export const noDuplicateTestRows = createRule<[], 'duplicate'>({
    name: 'no-duplicate-test-rows',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        fixable: 'code',
        docs: {
            level: 'recommended',
            description:
                'Reports a row of a parameterized Bun, Jest, or Vitest test or suite that repeats an earlier row of the same array literal, token for token. The fix deletes the copies.',
            why: 'A repeated row runs the same case twice. It costs time and suggests a case that someone meant to write and did not.',
            fix: 'Delete the copy, or change it to the case it was meant to test.',
            example: '`test.each([1, 2, 1])("adds %d", run)` reports `duplicate` on the second `1`.',
        },
        schema: [],
        messages: { duplicate: 'Remove this duplicate test case.' },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            [TABLE_CALL](node: TableCall) {
                for (const copies of listCopies(readTestTable(node, context), source)) {
                    const removals = copies.map((copy): [number, number] => [
                        source.getTokenBefore(copy)?.range[0] ?? copy.range[0],
                        copy.range[1],
                    ]);
                    context.report({
                        node: copies[0] ?? node,
                        messageId: 'duplicate',
                        fix: (fixer) => removals.map((range) => fixer.removeRange(range)),
                    });
                }
            },
        };
    },
});

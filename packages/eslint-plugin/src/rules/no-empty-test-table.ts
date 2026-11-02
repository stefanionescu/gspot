import { createRule } from '../rule.ts';
import { TABLE_CALL } from '../config/testing.ts';
import type { TableCall } from '../types/rules.ts';
import { readTestTable } from '../libraries/testing.ts';
import { unwrapExpression } from '../language/syntax.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';

function isEmptyArray(node: TSESTree.Node | null | undefined): boolean {
    if (node === null || node === undefined) return false;
    const value = unwrapExpression(node);
    return value.type === AST_NODE_TYPES.ArrayExpression && value.elements.length === 0;
}

function isEmptyVariable(table: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const variable = ASTUtils.isIdentifier(table) ? ASTUtils.findVariable(source.getScope(table), table) : null;
    const references = variable?.references ?? [];
    const writes = references.filter((reference) => reference.isWrite());
    const [write] = writes;
    const isChanged = references.some(
        ({ identifier }) =>
            identifier !== write?.identifier && identifier !== table && identifier.range[0] < table.range[0],
    );
    return writes.length === 1 && isEmptyArray(write?.writeExpr) && !isChanged;
}

export const noEmptyTestTable = createRule<[], 'empty'>({
    name: 'no-empty-test-table',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Reports an empty table of a parameterized Bun, Jest, or Vitest test or suite: an empty array literal, or a variable whose one value is an empty array that nothing changes before the call.',
            why: 'A parameterized test runs its body once per row. With no rows the body never runs, and the run still passes.',
            fix: 'Add the cases to the table, or delete the test.',
            example: '`test.each([])("adds %d", run)` reports `empty`. Write `test.each([1, 2])("adds %d", run)`.',
        },
        schema: [],
        messages: { empty: 'This parameterized test has no cases, so its body never runs.' },
    },
    create(context) {
        return {
            [TABLE_CALL](node: TableCall) {
                const table = readTestTable(node, context);
                const isEmpty =
                    table !== undefined && (isEmptyArray(table) || isEmptyVariable(table, context.sourceCode));
                if (isEmpty) context.report({ node: table, messageId: 'empty' });
            },
        };
    },
});

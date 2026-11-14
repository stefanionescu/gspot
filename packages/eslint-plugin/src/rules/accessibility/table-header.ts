import { createRule } from '../../rule.ts';
import type { TableCell } from '../../types/accessibility.ts';
import { getAttribute, getElementName } from '../../language/jsx.ts';
import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { isLayoutTable, buildTableGrid } from '../../language/html-tables.ts';

function hasHeaderLine(grid: ReadonlyArray<readonly TableCell[]> | null): boolean {
    if (grid === null) return true;
    const columns = Array.from({ length: grid[0]?.length ?? 0 }, (_, column) => column);
    const hasHeaderRow = grid.some((row) => row.every(({ isHeader }) => isHeader));
    return (
        hasHeaderRow ||
        columns.some((column) => grid.every((row) => column >= row.length || row[column]?.isHeader === true))
    );
}

function isSkippedTable(table: TSESTree.JSXElement): boolean {
    const element = table.openingElement;
    const isPassThrough =
        table.children.length === 0 &&
        element.attributes.some(({ type }) => type === AST_NODE_TYPES.JSXSpreadAttribute);
    return isPassThrough || isLayoutTable(element) || getAttribute(element, 'aria-hidden')?.value === true;
}

export const tableHeader = createRule<[], 'missingHeader'>({
    name: 'table-header',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Finds a JSX `<table>` without a full row or a full column of `<th>` cells, unless it is a layout table or hidden with `aria-hidden`.',
            why: 'Screen readers use header cells to tell users which row and column a data cell belongs to.',
            fix: 'Mark the cells of the first row or the first column as `<th>`.',
            example:
                'The element `<table><tr><td>Name</td><td>Age</td></tr><tr><td>Ada</td><td>36</td></tr></table>` reports `missingHeader`. Write the first row as `<tr><th>Name</th><th>Age</th></tr>`.',
        },
        schema: [],
        messages: { missingHeader: 'Add a header row or a header column of <th> cells to this table.' },
    },
    create(context) {
        return {
            JSXElement(node) {
                const isTable = getElementName(node.openingElement.name) === 'table';
                if (!isTable || isSkippedTable(node)) return;
                if (!hasHeaderLine(buildTableGrid(node))) context.report({ node, messageId: 'missingHeader' });
            },
        };
    },
});
